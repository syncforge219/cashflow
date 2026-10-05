import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Payment from "@/models/Payment";
import Admission from "@/models/Admission";
import Task from "@/models/Task";
import Company from "@/models/Company";
import Brand from "@/models/Brand";
import { getUserFromCookies, canDeleteFinancialRecords } from "@/lib/helper";
import { sendWhatsAppFeeReceipt, sendWhatsAppCompanyCapacityAlert, sendWhatsAppCompanyLimit80Alert } from "@/lib/msg91";
import { sendFeePaymentReceiptEmail } from "@/lib/emailService";
import { getFinancialYear, getFinancialYearRange } from "@/lib/financialYearHelper";
import { getCompanyPaymentRevenueMap, getCompanyFyRevenue } from "@/lib/companyRevenueHelper";
import { getStudentBalance, recomputeAndStoreAdmissionBalance } from "@/lib/studentBalanceService";
import { logAuditEntry } from "@/lib/auditLogger";
import { validateDeletedAccess } from "@/lib/softDeleteAccess";
import { withOptionalTransaction } from "@/lib/transactionHelper";
import { buildFeeSchedule, syncCustomPlanFlags } from "@/lib/feeSchedule";
import { todayKey, toDateKey, isDateKey, dateKeyToDate, istDayRange, monthBoundsKey } from "@/lib/dates";

/** Payment date from the form ("YYYY-MM-DD"). Today keeps the exact time; past days store that calendar day. */
function resolvePaymentDate(value: unknown): { date: Date } | { error: string } {
  if (value === undefined || value === null || value === "") return { date: new Date() };
  const key = toDateKey(value as any);
  if (!key || !isDateKey(key)) return { error: "Invalid payment date." };
  const today = todayKey();
  if (key > today) return { error: "Payment date cannot be in the future." };
  return { date: key === today ? new Date() : dateKeyToDate(key) };
}

/** Recompute balance from payments and align the custom EMI plan's paid flags (never its amounts). */
async function syncAdmissionAfterPaymentChange(admissionId: any, session: any) {
  const balance = await recomputeAndStoreAdmissionBalance(admissionId, session);
  const query = Admission.findById(admissionId);
  if (session) query.session(session);
  const admission: any = await query;
  if (admission) {
    const schedule = buildFeeSchedule(admission, { totalPaid: balance.totalPaid, totalFee: balance.finalFee });
    if (syncCustomPlanFlags(admission.customEmiPlan, schedule)) {
      admission.markModified("customEmiPlan");
      await admission.save(session ? { session } : undefined);
    }
  }
  return balance;
}

export async function GET(req: Request) {
  try {
    await dbConnect();

    const user = await getUserFromCookies();
    const { searchParams } = new URL(req.url);
    const deletedAccess = validateDeletedAccess(user, searchParams);
    if (deletedAccess.errorResponse) {
      return deletedAccess.errorResponse;
    }

    const admissionId = searchParams.get("admissionId");
    const brandParam = searchParams.get("brand");
    const companyParam = searchParams.get("company");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const filterParam = searchParams.get("filter");

    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    const isBrandRestricted = userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";

    const andConditions: any[] = [];

    if (deletedAccess.onlyDeleted) {
      andConditions.push({ isDeleted: true });
    }

    if (admissionId) {
      if (mongoose.Types.ObjectId.isValid(admissionId)) {
        andConditions.push({ admissionId: new mongoose.Types.ObjectId(admissionId) });
      } else {
        const foundAdm = await Admission.findOne({ admissionId: admissionId.trim() }).select("_id").lean();
        if (foundAdm && foundAdm._id) {
          andConditions.push({ admissionId: foundAdm._id });
        } else {
          andConditions.push({ admissionId: new mongoose.Types.ObjectId("000000000000000000000000") });
        }
      }
    }

    if (companyParam) {
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const cleanComp = companyParam.trim();
      const compRegex = new RegExp(`^${escapeRegExp(cleanComp)}$`, "i");

      const compDoc = mongoose.Types.ObjectId.isValid(cleanComp)
        ? await Company.findById(cleanComp).lean()
        : await Company.findOne({ $or: [{ name: compRegex }, { legalName: compRegex }] }).lean();
      const compId = compDoc?._id;

      const compAdmissions = await Admission.find(
        compId
          ? { $or: [{ companyId: compId }, { companyAssigned: compRegex }] }
          : { companyAssigned: compRegex }
      ).select("_id").lean();
      const compAdmissionIds = compAdmissions.map((a: any) => a._id);

      andConditions.push({
        $or: [
          ...(compId ? [{ companyId: compId }] : []),
          { company: compRegex },
          ...(compAdmissionIds.length > 0 ? [{ admissionId: { $in: compAdmissionIds } }] : [])
        ]
      });
    }

    const targetBrand = brandParam && brandParam !== "All Brands" && brandParam !== "all" ? brandParam : isBrandRestricted ? userBrand : null;

    if (targetBrand) {
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const targetBrandsArr = targetBrand.split(",").map((b: string) => b.trim()).filter(Boolean);
      const regexArray = targetBrandsArr.map((b: string) => new RegExp(`^${escapeRegExp(b)}$`, "i"));

      const brandDocs = await Brand.find({
        $or: [
          { name: { $in: regexArray } },
          { code: { $in: regexArray } },
          { _id: { $in: targetBrandsArr.filter((b: any) => mongoose.Types.ObjectId.isValid(b)) } }
        ]
      }).select("_id").lean();
      const brandIds = brandDocs.map(b => b._id);

      const brandAdmissions = await Admission.find({
        $or: [
          ...(brandIds.length > 0 ? [{ brandId: { $in: brandIds } }] : []),
          { brand: { $in: regexArray } }
        ]
      }).select("_id").lean();
      const brandAdmissionIds = brandAdmissions.map((a: any) => a._id);

      andConditions.push({
        $or: [
          ...(brandIds.length > 0 ? [{ brandId: { $in: brandIds } }] : []),
          { brand: { $in: regexArray } },
          { admissionId: { $in: brandAdmissionIds } }
        ]
      });
    }

    // Date filters are IST calendar days, independent of the server's time zone
    const fromKey = toDateKey(startDateParam);
    const toKey = toDateKey(endDateParam);
    if (fromKey && toKey) {
      const { start: s, end: e } = istDayRange(fromKey, toKey);
      andConditions.push({
        $or: [
          { paymentDate: { $gte: s, $lte: e } },
          { $and: [{ paymentDate: { $exists: false } }, { createdAt: { $gte: s, $lte: e } }] }
        ]
      });
    } else if (filterParam === "today") {
      const { start: s, end: e } = istDayRange(todayKey());
      andConditions.push({
        $or: [
          { paymentDate: { $gte: s, $lte: e } },
          { $and: [{ paymentDate: { $exists: false } }, { createdAt: { $gte: s, $lte: e } }] }
        ]
      });
    } else if (filterParam === "thisMonth") {
      const { first, last } = monthBoundsKey();
      const { start: s, end: e } = istDayRange(first, last);
      andConditions.push({
        $or: [
          { paymentDate: { $gte: s, $lte: e } },
          { $and: [{ paymentDate: { $exists: false } }, { createdAt: { $gte: s, $lte: e } }] }
        ]
      });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    let payments = await Payment.find(query)
      .populate("admissionId", "fullName admissionId brand brandId course batch counsellor counsellorId mobileNumber remainingBalance finalFee admissionDate companyAssigned companyId company")
      .populate("brandId", "name code")
      .populate("companyId", "name legalName")
      .sort({ paymentDate: -1, createdAt: -1 })
      .lean();

    // Strict post-filtering to guarantee no cross-brand data leaks
    if (targetBrand) {
      const targetBrandsLower = targetBrand.split(",").map((b: string) => b.trim().toLowerCase()).filter(Boolean);
      payments = payments.filter((p: any) => {
        const pb = (p.brand || p.admissionId?.brand || "").trim().toLowerCase();
        // A payment with no brand must not match every brand ("x".includes("") is true)
        return Boolean(pb) && targetBrandsLower.some((tb: string) => pb === tb || pb.includes(tb) || tb.includes(pb));
      });
    }

    // Anywhere the UI shows a payment list for a student, display the current name by joining/populating via admissionId
    payments = payments.map((p: any) => ({
      ...p,
      originalIssuedName: p.studentName,
      studentName: p.admissionId?.fullName || p.studentName,
    }));

    return NextResponse.json({ success: true, data: payments });
  } catch (error: any) {
    console.error("Error fetching payments:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch payments." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const body = await req.json();

    const { admissionId, amountReceived, paymentMode, referenceNo, remarks, company, particulars } = body;

    if (!admissionId || !amountReceived || !paymentMode) {
      return NextResponse.json(
        { success: false, message: "Missing required fields (admissionId, amountReceived, paymentMode)." },
        { status: 400 }
      );
    }
    if (!(Number(amountReceived) > 0)) {
      return NextResponse.json({ success: false, message: "Amount received must be greater than zero." }, { status: 400 });
    }
    const resolvedDate = resolvePaymentDate(body.paymentDate);
    if ("error" in resolvedDate) {
      return NextResponse.json({ success: false, message: resolvedDate.error }, { status: 400 });
    }

    // 1. Find the admission record
    const admFilter: any = mongoose.Types.ObjectId.isValid(admissionId)
      ? { _id: admissionId }
      : { admissionId: String(admissionId) };
    const admission: any = await Admission.findOne(admFilter);
    if (!admission) {
      return NextResponse.json(
        { success: false, message: "Admission record not found." },
        { status: 404 }
      );
    }

    // Sanitize any legacy empty string ObjectId refs on admission
    if (!admission.batchId || admission.batchId === "" || admission.batchId === "Unassigned" || admission.batchId === "General Batch" || !mongoose.Types.ObjectId.isValid(admission.batchId)) {
      admission.batchId = null;
    }
    if (!admission.brandId || admission.brandId === "" || !mongoose.Types.ObjectId.isValid(admission.brandId)) {
      admission.brandId = null;
    }
    if (!admission.companyId || admission.companyId === "" || !mongoose.Types.ObjectId.isValid(admission.companyId)) {
      admission.companyId = null;
    }
    if (!admission.counsellorId || admission.counsellorId === "" || !mongoose.Types.ObjectId.isValid(admission.counsellorId)) {
      admission.counsellorId = null;
    }
    if (!admission.enquiryId || admission.enquiryId === "" || !mongoose.Types.ObjectId.isValid(admission.enquiryId)) {
      admission.enquiryId = null;
    }
    if (admission.errors) {
      delete admission.errors.batchId;
      delete admission.errors.brandId;
      delete admission.errors.companyId;
      delete admission.errors.counsellorId;
      delete admission.errors.enquiryId;
    }

    // 2. Company Allocation Engine: Use student's admission company first
    const studentAdmissionCompany = (admission.companyAssigned || "").trim();
    const hasValidAdmissionCompany = studentAdmissionCompany && 
      studentAdmissionCompany !== "Cash" && 
      studentAdmissionCompany !== "Unallocated" && 
      studentAdmissionCompany !== "Cash (Unallocated)" && 
      studentAdmissionCompany !== "Auto";

    let finalCompany = "";
    if (paymentMode === "Cash") {
      finalCompany = "Cash";
    } else if (hasValidAdmissionCompany) {
      // ALWAYS use the company assigned at admission! Do not re-allocate!
      finalCompany = studentAdmissionCompany;
    } else {
      const reqCompany = (company || body.allocatedCompany || body.companyAssigned || "").trim();
      if (reqCompany && reqCompany !== "Auto" && reqCompany !== "Select Company..." && reqCompany !== "Unallocated" && reqCompany !== "Cash (Unallocated)") {
        finalCompany = reqCompany;
      } else {
        const previousNonCashPayment = await Payment.findOne({
          admissionId: admission._id,
          paymentMode: { $not: /^cash$/i },
          company: { $nin: ["Cash", "CASH", "cash", "Unallocated", "UNALLOCATED", "unallocated", "Cash (Unallocated)", "CASH (UNALLOCATED)"] }
        });

        if (previousNonCashPayment && previousNonCashPayment.company) {
          finalCompany = previousNonCashPayment.company;
        } else {
          const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const brandStr = (admission.brand || "").trim();
          const brandRegex = new RegExp(`^${escapeRegExp(brandStr)}$`, "i");

          const brandDoc = await Brand.findOne({ name: { $regex: brandRegex } }).lean();
          const brandCompanies = brandDoc?.companies || [];

          const safeCompRegexes = brandCompanies.map((c: string) => new RegExp(`^${escapeRegExp(c.trim())}$`, "i"));

          const availableCompanies = await Company.find({
            $or: [
              { brand: { $regex: brandRegex } },
              { brands: { $regex: brandRegex } },
              ...(safeCompRegexes.length > 0 ? [{ name: { $in: safeCompRegexes } }] : [])
            ],
            status: "ACTIVE"
          });

          if (availableCompanies.length > 0) {
            const fyRange = getFinancialYearRange();
            const fyRevenueMap = await getCompanyPaymentRevenueMap(fyRange);
            const getRemCap = (c: any) => {
              const cap = Number(c.annualCapacityCap || 1949999);
              const collected = fyRevenueMap.get(String(c._id)) || 0;
              return Math.max(0, cap - collected);
            };

            availableCompanies.sort((a, b) => getRemCap(b) - getRemCap(a));

            finalCompany = availableCompanies[0].name;
          } else {
            finalCompany = "Unallocated";
          }
        }
      }
    }

    // Update Ledger: Block entire student fee if company is newly assigned or changed; avoid double-counting on EMI payments for already-blocked students
    const studentFullFee = Number(admission.finalFee) > 0 
      ? Number(admission.finalFee) 
      : (Number(admission.courseFee) > 0 ? Number(admission.courseFee) : Number(amountReceived));

    const oldCompany = (admission.companyAssigned || "").trim();

    if (finalCompany && finalCompany !== "Cash" && finalCompany !== "Unallocated" && finalCompany !== "Cash (Unallocated)") {
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const isSameCompany = oldCompany && oldCompany.toLowerCase() === finalCompany.toLowerCase();

      if (!isSameCompany) {
        const { label: currentFY } = getFinancialYearRange();
        const admDate = admission.admissionDate ? new Date(admission.admissionDate) : (admission.createdAt ? new Date(admission.createdAt) : new Date());
        const admFY = getFinancialYear(admDate);

        // If changing company or allocating company for the first time
        if (oldCompany && oldCompany !== "Cash" && oldCompany !== "Unallocated" && oldCompany !== "Cash (Unallocated)") {
          // Unblock full fee from old company
          let oldComp = admission.companyId ? await Company.findById(admission.companyId) : null;
          if (!oldComp) {
            const oldCompRegex = new RegExp(`^${escapeRegExp(oldCompany)}$`, "i");
            oldComp = await Company.findOne({ $or: [{ name: { $regex: oldCompRegex } }, { legalName: { $regex: oldCompRegex } }] });
          }
          if (oldComp && (oldComp.currentFinancialYear === admFY || (!oldComp.currentFinancialYear && admFY === currentFY))) {
            oldComp.collectedRevenue = Math.max(0, (oldComp.collectedRevenue || 0) - studentFullFee);
            await oldComp.save();
          }
        }

        // Block full fee in new company for current financial year
        const targetNewCompanyId = body.companyId || admission.companyId;
        let updatedComp = targetNewCompanyId ? await Company.findById(targetNewCompanyId) : null;
        if (!updatedComp) {
          const compRegex = new RegExp(`^${escapeRegExp(finalCompany.trim())}$`, "i");
          updatedComp = await Company.findOne({ $or: [{ name: { $regex: compRegex } }, { legalName: { $regex: compRegex } }] });
        }
        if (updatedComp) {
          if (updatedComp.currentFinancialYear === admFY) {
            updatedComp.collectedRevenue = (updatedComp.collectedRevenue || 0) + studentFullFee;
          } else if (admFY === currentFY) {
            updatedComp.currentFinancialYear = currentFY;
            updatedComp.collectedRevenue = studentFullFee;
            updatedComp.alerted80Percent = false;
          }
          await updatedComp.save();
        }

        if (updatedComp) {
          const cap = updatedComp.annualCapacityCap || 1949999;
          const collected = updatedComp.collectedRevenue || 0;
          const pct = cap > 0 ? (collected / cap) * 100 : 0;

          // Automatically send WhatsApp alert ONLY to Super Admin when capacity reaches 80%+
          if (pct >= 80 && !(updatedComp as any).alerted80Percent) {
            (updatedComp as any).alerted80Percent = true;
            await updatedComp.save();

            sendWhatsAppCompanyLimit80Alert({
              companyName: updatedComp.name,
              brandName: admission.brand || (admission as any).brandName,
            }).catch((err) => console.error("[Payment API] WhatsApp 80% Capacity Limit Alert error:", err));
          }

          // Automatically send WhatsApp notification to Admin when capacity reaches 95%+
          if (pct >= 95) {
            sendWhatsAppCompanyCapacityAlert({
              companyName: updatedComp.name,
              collectedRevenue: collected,
              annualCapacityCap: cap,
              capacityPercentage: pct,
            }).catch((err) => console.error("[Payment API] WhatsApp 95% Capacity Alert error:", err));
          }
        }
      }

      // Lock future payments to this company
      admission.companyAssigned = finalCompany;
    }

    // 2. Create the payment record & recompute admission balance inside transaction (with standalone fallback)
    let payment: any;
    let newBalance = 0;

    await withOptionalTransaction(async (session) => {
      payment = new Payment({
        admissionId: admission._id,
        studentName: admission.fullName,
        amountReceived: Number(amountReceived),
        paymentDate: resolvedDate.date,
        paymentMode,
        referenceNo,
        remarks,
        company: finalCompany,
        companyId: admission.companyId,
        brand: admission.brand,
        brandId: admission.brandId,
        particulars,
      });
      await payment.save({ session });

      // 3. Recompute balance strictly from payment aggregation inside transaction
      const balanceResult = await getStudentBalance(admission._id, session);
      newBalance = balanceResult.remainingBalance;
      admission.remainingBalance = newBalance;
      admission.amountReceivedToday = balanceResult.totalPaid;

      // downpaymentAmount is the AGREED down payment and the EMI plan amounts are the agreed
      // instalments: neither changes when money comes in. What is paid is derived from payments;
      // only the informational isPaid/paidDate flags are aligned here.
      const schedule = buildFeeSchedule(admission, {
        totalPaid: balanceResult.totalPaid,
        totalFee: balanceResult.finalFee,
      });
      if (syncCustomPlanFlags(admission.customEmiPlan, schedule, resolvedDate.date)) {
        admission.markModified("customEmiPlan");
      }

      await admission.save({ session });
    });

    if (payment?._id) {
      await logAuditEntry({
        collectionName: "payments",
        docId: payment._id,
        action: "CREATE",
        changedFields: [
          { field: "amountReceived", oldValue: null, newValue: payment.amountReceived },
          { field: "paymentMode", oldValue: null, newValue: payment.paymentMode },
          { field: "company", oldValue: null, newValue: payment.company },
          { field: "companyId", oldValue: null, newValue: payment.companyId },
          { field: "brand", oldValue: null, newValue: payment.brand },
          { field: "brandId", oldValue: null, newValue: payment.brandId },
        ],
        userId: (user as any)?._id,
      });
    }

    // Auto-complete open fee follow-up tasks if remaining balance is fully cleared
    if (newBalance === 0) {
      try {
        await Task.updateMany(
          {
            $or: [
              { linkedStudentId: admission._id.toString() },
              { linkedStudentName: admission.fullName }
            ],
            taskType: { $in: ["Fee Follow-up", "Fee Collection", "EMI Recovery", "Follow-up"] },
            status: { $in: ["Pending", "In Progress"] }
          },
          {
            $set: {
              status: "Completed",
              completedAt: new Date()
            }
          }
        );
      } catch (taskErr) {
        console.error("[Payment API] Error completing fee tasks:", taskErr);
      }
    }

    // 4. Dispatch Email Fee Receipt Notification (with official PDF attachment)
    try {
      if (admission.email) {
        sendFeePaymentReceiptEmail({ payment, admission })
          .then((res) => console.log(`[Payment API] Fee receipt email sent to ${admission.email}. Res:`, res))
          .catch((err) => console.error("[Payment API] Fee receipt email error:", err));
      }
    } catch (emailErr) {
      console.error("Failed to trigger Email fee receipt:", emailErr);
    }

    // 5. Dispatch MSG91 WhatsApp Fee Receipt notification
    try {
      if (admission.mobileNumber) {
        sendWhatsAppFeeReceipt({
          studentName: admission.fullName,
          mobileNumber: admission.mobileNumber,
          courseName: admission.course,
          amountPaid: Number(amountReceived),
          // ISO date key: formatDateOnly() renders it in IST. A "d/m/yyyy" string was parsed as m/d.
          paymentDate: toDateKey(payment.paymentDate || payment.createdAt || new Date()),
          receiptNo: payment.receiptNo,
        }).catch((err) => console.error("Async MSG91 WhatsApp Error:", err));
      }

    } catch (waErr) {
      console.error("Failed to trigger WhatsApp receipt:", waErr);
    }

    return NextResponse.json(
      { success: true, message: "Payment processed successfully.", data: payment },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error processing payment:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process payment." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const body = await req.json();
    const id = body.id || body._id || searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Payment ID is required." },
        { status: 400 }
      );
    }

    const existingPayment = await Payment.findById(id);
    if (!existingPayment) {
      return NextResponse.json(
        { success: false, message: "Payment record not found." },
        { status: 404 }
      );
    }

    const oldAmount = Number(existingPayment.amountReceived) || 0;

    if (body.paymentDate) {
      const resolved = resolvePaymentDate(body.paymentDate);
      if ("error" in resolved) {
        return NextResponse.json({ success: false, message: resolved.error }, { status: 400 });
      }
      // Only change the stored value when the calendar date actually changes (keeps time of day)
      if (toDateKey(existingPayment.paymentDate) !== toDateKey(resolved.date)) {
        existingPayment.paymentDate = resolved.date;
      }
    }
    if (body.paymentMode) {
      existingPayment.paymentMode = body.paymentMode;
    }
    if (body.referenceNo !== undefined) {
      existingPayment.referenceNo = body.referenceNo;
    }
    if (body.remarks !== undefined) {
      existingPayment.remarks = body.remarks;
    }
    if (body.company !== undefined) {
      existingPayment.company = body.company;
    }

    if (body.amountReceived !== undefined) {
      if (!(Number(body.amountReceived) > 0)) {
        return NextResponse.json({ success: false, message: "Amount received must be greater than zero." }, { status: 400 });
      }
      existingPayment.amountReceived = Number(body.amountReceived);
    }

    await withOptionalTransaction(async (session) => {
      await existingPayment.save({ session });

      // Sync admission remaining balance if amount changed
      const newAmount = Number(existingPayment.amountReceived) || 0;
      const diff = newAmount - oldAmount;
      if (diff !== 0 && existingPayment.admissionId) {
        await syncAdmissionAfterPaymentChange(existingPayment.admissionId, session);
      }
    });

    return NextResponse.json({
      success: true,
      message: "Payment updated successfully",
      data: existingPayment,
    });
  } catch (error: any) {
    console.error("Error updating payment:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update payment" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");
    if (!id) {
      try {
        const body = await req.json();
        id = body.id || body._id;
      } catch (_) {}
    }

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Payment ID is required for deletion." },
        { status: 400 }
      );
    }

    const payment: any = await Payment.findById(id);
    if (!payment) {
      return NextResponse.json(
        { success: false, message: "Payment record not found." },
        { status: 404 }
      );
    }

    const deletedAmount = Number(payment.amountReceived) || 0;
    const paymentCompany = (payment.company || "").trim();
    const admissionId = payment.admissionId;
    const receiptNo = payment.receiptNo || "N/A";

    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    if (!canDeleteFinancialRecords(user.role)) {
      return NextResponse.json(
        { success: false, message: "Forbidden: You do not have permission to delete payment receipts." },
        { status: 403 }
      );
    }
    const userId = (user as any)?._id || null;

    // 1. Soft delete payment & recompute admission balance inside transaction (with standalone fallback)
    let updatedAdmission: any = null;
    await withOptionalTransaction(async (session) => {
      payment.isDeleted = true;
      payment.deletedAt = new Date();
      payment.deletedBy = userId;
      await payment.save({ session });

      if (admissionId) {
        await syncAdmissionAfterPaymentChange(admissionId, session);
        updatedAdmission = await Admission.findById(admissionId).session(session);
      }
    });

    // 2. Reverse Company Collection if company is valid
    let reversedCompany = null;
    if (
      paymentCompany &&
      paymentCompany !== "Cash" &&
      paymentCompany !== "Unallocated" &&
      paymentCompany !== "Cash (Unallocated)"
    ) {
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const compRegex = new RegExp(`^${escapeRegExp(paymentCompany)}$`, "i");

      const payDate = payment.paymentDate ? new Date(payment.paymentDate) : (payment.createdAt ? new Date(payment.createdAt) : new Date());
      const payFY = getFinancialYear(payDate);
      const { label: currentFY } = getFinancialYearRange();

      const compDoc = await Company.findOne({
        $or: [{ name: { $regex: compRegex } }, { legalName: { $regex: compRegex } }]
      });
      if (compDoc) {
        if (compDoc.currentFinancialYear === payFY || (!compDoc.currentFinancialYear && payFY === currentFY)) {
          compDoc.collectedRevenue = Math.max(0, (compDoc.collectedRevenue || 0) - deletedAmount);
          await compDoc.save();
        }
        reversedCompany = compDoc.name;
      }
    }

    await logAuditEntry({
      collectionName: "payments",
      docId: payment._id,
      action: "SOFT_DELETE",
      changedFields: [{ field: "isDeleted", oldValue: false, newValue: true }],
      userId
    });

    return NextResponse.json({
      success: true,
      message: `Payment receipt ${receiptNo} (₹${deletedAmount.toLocaleString("en-IN")}) deleted successfully.`,
      data: {
        deletedPaymentId: id,
        receiptNo,
        deletedAmount,
        reversedCompany,
        remainingBalance: updatedAdmission?.remainingBalance,
        totalCollected: updatedAdmission
          ? (Number(updatedAdmission.finalFee || updatedAdmission.courseFee || 0) - Number(updatedAdmission.remainingBalance || 0))
          : 0,
      },
    });
  } catch (error: any) {
    console.error("Error deleting payment:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete payment record." },
      { status: 500 }
    );
  }
}
