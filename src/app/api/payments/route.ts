import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Payment from "@/models/Payment";
import Admission from "@/models/Admission";
import Task from "@/models/Task";
import Company from "@/models/Company";
import Brand from "@/models/Brand";
import { getUserFromCookies } from "@/lib/helper";
import { sendWhatsAppFeeReceipt, sendWhatsAppCompanyCapacityAlert, sendWhatsAppCompanyLimit80Alert } from "@/lib/msg91";
import { sendFeePaymentReceiptEmail } from "@/lib/emailService";


export async function GET(req: Request) {
  try {
    await dbConnect();

    const user = await getUserFromCookies();
    const { searchParams } = new URL(req.url);
    const admissionId = searchParams.get("admissionId");
    const brandParam = searchParams.get("brand");
    const companyParam = searchParams.get("company");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const filterParam = searchParams.get("filter");

    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    const isBrandRestricted = userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";

    const andConditions: any[] = [];

    if (admissionId) {
      andConditions.push({ admissionId });
    }

    if (companyParam) {
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const cleanComp = companyParam.trim();
      const compRegex = new RegExp(`^${escapeRegExp(cleanComp)}$`, "i");

      const compAdmissions = await Admission.find({
        companyAssigned: compRegex
      }).select("_id").lean();
      const compAdmissionIds = compAdmissions.map((a: any) => a._id);

      andConditions.push({
        $or: [
          { company: compRegex },
          { company: { $regex: new RegExp(escapeRegExp(cleanComp), "i") } },
          ...(compAdmissionIds.length > 0 ? [{ admissionId: { $in: compAdmissionIds } }] : [])
        ]
      });
    }

    const targetBrand = brandParam && brandParam !== "All Brands" && brandParam !== "all" ? brandParam : isBrandRestricted ? userBrand : null;

    if (targetBrand) {
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const targetBrandsArr = targetBrand.split(",").map((b: string) => b.trim()).filter(Boolean);
      const regexArray = targetBrandsArr.map((b: string) => new RegExp(`^${escapeRegExp(b)}$`, "i"));

      const brandAdmissions = await Admission.find({ brand: { $in: regexArray } }).select("_id").lean();
      const brandAdmissionIds = brandAdmissions.map((a: any) => a._id);

      andConditions.push({
        $or: [
          { brand: { $in: regexArray } },
          { admissionId: { $in: brandAdmissionIds } }
        ]
      });
    }

    if (startDateParam && endDateParam) {
      const s = new Date(startDateParam);
      s.setHours(0, 0, 0, 0);
      const e = new Date(endDateParam);
      e.setHours(23, 59, 59, 999);
      andConditions.push({
        $or: [
          { paymentDate: { $gte: s, $lte: e } },
          { $and: [{ paymentDate: { $exists: false } }, { createdAt: { $gte: s, $lte: e } }] }
        ]
      });
    } else if (filterParam === "today") {
      const s = new Date();
      s.setHours(0, 0, 0, 0);
      const e = new Date();
      e.setHours(23, 59, 59, 999);
      andConditions.push({
        $or: [
          { paymentDate: { $gte: s, $lte: e } },
          { $and: [{ paymentDate: { $exists: false } }, { createdAt: { $gte: s, $lte: e } }] }
        ]
      });
    } else if (filterParam === "thisMonth") {
      const now = new Date();
      const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      andConditions.push({
        $or: [
          { paymentDate: { $gte: s, $lte: e } },
          { $and: [{ paymentDate: { $exists: false } }, { createdAt: { $gte: s, $lte: e } }] }
        ]
      });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    let payments = await Payment.find(query)
      .populate("admissionId", "fullName admissionId brand course batch counsellor mobileNumber remainingBalance finalFee admissionDate companyAssigned")
      .sort({ createdAt: -1 })
      .lean();

    // Strict post-filtering to guarantee no cross-brand data leaks
    if (targetBrand) {
      const targetBrandsLower = targetBrand.split(",").map((b: string) => b.trim().toLowerCase()).filter(Boolean);
      payments = payments.filter((p: any) => {
        const pb = (p.brand || p.admissionId?.brand || "").trim().toLowerCase();
        return targetBrandsLower.some((tb: string) => pb === tb || pb.includes(tb) || tb.includes(pb));
      });
    }

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
    const body = await req.json();

    const { admissionId, amountReceived, paymentMode, referenceNo, remarks, company, particulars } = body;

    if (!admissionId || !amountReceived || !paymentMode) {
      return NextResponse.json(
        { success: false, message: "Missing required fields (admissionId, amountReceived, paymentMode)." },
        { status: 400 }
      );
    }

    // 1. Find the admission record
    const admission = await Admission.findById(admissionId);
    if (!admission) {
      return NextResponse.json(
        { success: false, message: "Admission record not found." },
        { status: 404 }
      );
    }

    // 2. Company Allocation Engine: Use student's admission company first
    const studentAdmissionCompany = (admission.companyAssigned || "").trim();
    const hasValidAdmissionCompany = studentAdmissionCompany && 
      studentAdmissionCompany !== "Cash" && 
      studentAdmissionCompany !== "Unallocated" && 
      studentAdmissionCompany !== "Cash (Unallocated)" && 
      studentAdmissionCompany !== "Auto";

    let finalCompany = (company || body.allocatedCompany || body.companyAssigned || "").trim();

    if (!finalCompany || finalCompany === "Auto" || finalCompany === "Select Company..." || finalCompany === "Unallocated" || finalCompany === "Cash (Unallocated)") {
      if (hasValidAdmissionCompany) {
        // ALWAYS use the company assigned at admission! Do not re-allocate!
        finalCompany = studentAdmissionCompany;
      } else if (paymentMode === "Cash") {
        finalCompany = "Cash";
      } else {
        const previousNonCashPayment = await Payment.findOne({
          admissionId,
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
            availableCompanies.sort((a, b) => {
              const capA = (a.annualCapacityCap || 1949999) - (a.collectedRevenue || 0);
              const capB = (b.annualCapacityCap || 1949999) - (b.collectedRevenue || 0);
              return capB - capA;
            });

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
        // If changing company or allocating company for the first time
        if (oldCompany && oldCompany !== "Cash" && oldCompany !== "Unallocated" && oldCompany !== "Cash (Unallocated)") {
          // Unblock full fee from old company
          const oldCompRegex = new RegExp(`^${escapeRegExp(oldCompany)}$`, "i");
          await Company.updateOne(
            { $or: [{ name: { $regex: oldCompRegex } }, { legalName: { $regex: oldCompRegex } }] },
            { $inc: { collectedRevenue: -studentFullFee } }
          );
        }

        // Block full fee in new company
        const compRegex = new RegExp(`^${escapeRegExp(finalCompany.trim())}$`, "i");
        const updatedComp = await Company.findOneAndUpdate(
          { $or: [{ name: { $regex: compRegex } }, { legalName: { $regex: compRegex } }] },
          { $inc: { collectedRevenue: studentFullFee } },
          { new: true }
        );

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

    // 2. Create the payment record
    const payment = new Payment({
      admissionId,
      studentName: admission.fullName,
      amountReceived: Number(amountReceived),
      paymentMode,
      referenceNo,
      remarks,
      company: finalCompany,
      brand: admission.brand,
      particulars,
    });
    await payment.save();

    // 3. Update the admission balance, settle custom EMI plan installments, and update pending collection tasks
    const receivedAmt = Number(amountReceived);
    const newBalance = Math.max(0, admission.remainingBalance - receivedAmt);
    admission.remainingBalance = newBalance;

    if (body.isDownpayment || particulars?.isDownpayment || particulars?.paymentCategory === "Down Payment" || (remarks && remarks.toLowerCase().includes("down payment"))) {
      admission.downpaymentAmount = (Number(admission.downpaymentAmount) || 0) + receivedAmt;
    }

    // Synchronize custom EMI plan installments
    if (Array.isArray(admission.customEmiPlan) && admission.customEmiPlan.length > 0) {
      if (newBalance === 0) {
        // Full fee paid off - mark all installments as paid
        admission.customEmiPlan.forEach((item: any) => {
          item.isPaid = true;
          if (!item.paidDate) item.paidDate = new Date();
        });
      } else if (receivedAmt > 0) {
        // Apply received payment chronologically against unpaid installments
        let creditRemaining = receivedAmt;
        for (const item of admission.customEmiPlan) {
          if (creditRemaining <= 0) break;
          if (!item.isPaid) {
            const itemAmt = Number(item.amount) || 0;
            if (creditRemaining >= itemAmt) {
              item.isPaid = true;
              item.paidDate = new Date();
              creditRemaining -= itemAmt;
            } else {
              // Partial payment on this installment: reduce remaining amount due for this installment
              item.amount = Math.max(0, itemAmt - creditRemaining);
              creditRemaining = 0;
            }
          }
        }
      }
    }

    await admission.save();

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
          paymentDate: new Date(payment.createdAt || Date.now()).toLocaleDateString("en-IN"),
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
      existingPayment.paymentDate = new Date(body.paymentDate);
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

    if (body.amountReceived !== undefined && !isNaN(Number(body.amountReceived))) {
      existingPayment.amountReceived = Number(body.amountReceived);
    }

    await existingPayment.save();

    // Sync admission remaining balance if amount changed
    const newAmount = Number(existingPayment.amountReceived) || 0;
    const diff = newAmount - oldAmount;
    if (diff !== 0 && existingPayment.admissionId) {
      const admission = await Admission.findById(existingPayment.admissionId);
      if (admission) {
        admission.remainingBalance = Math.max(0, (Number(admission.remainingBalance) || 0) - diff);
        await admission.save();
      }
    }

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
