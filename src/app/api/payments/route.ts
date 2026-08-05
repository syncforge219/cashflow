import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Payment from "@/models/Payment";
import Admission from "@/models/Admission";
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
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const filterParam = searchParams.get("filter");

    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    const isBrandRestricted = userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";

    let query: any = {};
    if (admissionId) {
      query.admissionId = admissionId;
    }

    const targetBrand = brandParam && brandParam !== "All Brands" && brandParam !== "all" ? brandParam : isBrandRestricted ? userBrand : null;

    if (targetBrand) {
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const targetBrandsArr = targetBrand.split(",").map((b: string) => b.trim()).filter(Boolean);
      const regexArray = targetBrandsArr.map((b: string) => new RegExp(`^${escapeRegExp(b)}$`, "i"));

      const brandAdmissions = await Admission.find({ brand: { $in: regexArray } }).select("_id").lean();
      const brandAdmissionIds = brandAdmissions.map((a: any) => a._id);

      query.$or = [
        { brand: { $in: regexArray } },
        { admissionId: { $in: brandAdmissionIds } }
      ];
    }

    if (startDateParam && endDateParam) {
      const s = new Date(startDateParam);
      s.setHours(0, 0, 0, 0);
      const e = new Date(endDateParam);
      e.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: s, $lte: e };
    } else if (filterParam === "today") {
      const s = new Date();
      s.setHours(0, 0, 0, 0);
      const e = new Date();
      e.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: s, $lte: e };
    } else if (filterParam === "thisMonth") {
      const now = new Date();
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      s.setHours(0, 0, 0, 0);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      e.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: s, $lte: e };
    }

    const payments = await Payment.find(query)
      .populate("admissionId", "fullName admissionId brand course batch counsellor mobileNumber remainingBalance finalFee")
      .sort({ createdAt: -1 })
      .lean();

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

    // 2. Company Allocation Engine: Use explicitly selected company if provided by user in receipt form
    let finalCompany = (company || body.allocatedCompany || body.companyAssigned || "").trim();

    if (!finalCompany || finalCompany === "Auto" || finalCompany === "Select Company..." || finalCompany === "Unallocated" || finalCompany === "Cash (Unallocated)") {
      if (paymentMode === "Cash") {
        finalCompany = "Cash";
      } else {
        const previousNonCashPayment = await Payment.findOne({
          admissionId,
          paymentMode: { $ne: "Cash" },
          company: { $nin: ["Cash", "Unallocated", "Cash (Unallocated)"] }
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

    // Update Ledger (increment collectedRevenue) for the assigned company
    if (finalCompany && finalCompany !== "Cash" && finalCompany !== "Unallocated" && finalCompany !== "Cash (Unallocated)") {
      if (Number(amountReceived) > 0) {
        const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const compRegex = new RegExp(`^${escapeRegExp(finalCompany.trim())}$`, "i");
        const updatedComp = await Company.findOneAndUpdate(
          { $or: [{ name: { $regex: compRegex } }, { legalName: { $regex: compRegex } }] },
          { $inc: { collectedRevenue: Number(amountReceived) } },
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

      // Lock future payments
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

    // 3. Update the admission balance and last transaction details
    admission.remainingBalance = Math.max(0, admission.remainingBalance - Number(amountReceived));
    if (body.isDownpayment || particulars?.isDownpayment || particulars?.paymentCategory === "Down Payment" || (remarks && remarks.toLowerCase().includes("down payment"))) {
      admission.downpaymentAmount = (Number(admission.downpaymentAmount) || 0) + Number(amountReceived);
    }
    await admission.save();

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
