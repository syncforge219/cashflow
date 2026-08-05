import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Enquiry from "@/models/Enquiry";

export async function GET() {
  try {
    await dbConnect();

    const admissions = await Admission.find({});
    const updatedRecords: any[] = [];

    for (const adm of admissions) {
      let targetDate: Date | null = null;

      // 1. Check if admission has explicit paymentDate stored on document
      if (adm.paymentDate && !isNaN(new Date(adm.paymentDate).getTime())) {
        targetDate = new Date(adm.paymentDate);
      }

      // 2. Check earliest Payment receipt associated with this admission
      const firstPayment = await Payment.findOne({ admissionId: adm._id }).sort({ createdAt: 1, paymentDate: 1 }).lean();
      if (firstPayment) {
        const payDate = firstPayment.paymentDate ? new Date(firstPayment.paymentDate) : (firstPayment.createdAt ? new Date(firstPayment.createdAt) : null);
        if (payDate && !isNaN(payDate.getTime())) {
          if (!targetDate || payDate.getTime() < targetDate.getTime()) {
            targetDate = payDate;
          }
        }
      }

      // 3. Check linked Enquiry date if available
      if (adm.enquiryId) {
        const enq = await Enquiry.findById(adm.enquiryId).lean();
        if (enq && enq.createdAt) {
          const enqDate = new Date(enq.createdAt);
          if (!isNaN(enqDate.getTime())) {
            if (!targetDate || enqDate.getTime() < targetDate.getTime()) {
              targetDate = enqDate;
            }
          }
        }
      }

      // 4. Check custom EMI plan first due date minus 1 month if present
      if (Array.isArray(adm.customEmiPlan) && adm.customEmiPlan.length > 0 && adm.customEmiPlan[0].dueDate) {
        const emi1Date = new Date(adm.customEmiPlan[0].dueDate);
        if (!isNaN(emi1Date.getTime())) {
          const estimatedAdmDate = new Date(emi1Date);
          estimatedAdmDate.setMonth(estimatedAdmDate.getMonth() - 1);
          if (!targetDate || estimatedAdmDate.getTime() < targetDate.getTime()) {
            targetDate = estimatedAdmDate;
          }
        }
      }

      // 5. Check startDate if available
      if (adm.startDate && !isNaN(new Date(adm.startDate).getTime())) {
        const stDate = new Date(adm.startDate);
        if (!targetDate || stDate.getTime() < targetDate.getTime()) {
          targetDate = stDate;
        }
      }

      // Fallback to createdAt
      if (!targetDate) {
        targetDate = adm.createdAt ? new Date(adm.createdAt) : new Date();
      }

      // Reconcile customEmiPlan against paid amount
      const totalFee = Number((adm as any).finalFee || (adm as any).totalFee || 0);
      const remainingBal = Number(adm.remainingBalance) || 0;
      const paidAmt = Math.max(0, totalFee - remainingBal);

      let emiUpdated = false;
      if (Array.isArray(adm.customEmiPlan) && adm.customEmiPlan.length > 0) {
        let credit = paidAmt;
        for (const item of adm.customEmiPlan) {
          const itemAmt = Number(item.amount) || 0;
          if (credit >= itemAmt) {
            if (!item.isPaid) {
              item.isPaid = true;
              item.paidDate = item.paidDate || new Date();
              emiUpdated = true;
            }
            credit -= itemAmt;
          } else break;
        }
      }

      const currentAdmDateStr = adm.admissionDate ? new Date(adm.admissionDate).toISOString() : null;
      const targetDateStr = targetDate.toISOString();

      if (!adm.admissionDate || currentAdmDateStr !== targetDateStr || emiUpdated) {
        adm.admissionDate = targetDate;
        await adm.save();
        updatedRecords.push({
          admissionId: adm.admissionId,
          fullName: adm.fullName,
          oldAdmissionDate: currentAdmDateStr,
          fixedAdmissionDate: targetDateStr,
          formatted: targetDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          emiUpdated,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${admissions.length} admissions. Updated ${updatedRecords.length} records with fixed admission dates.`,
      updatedCount: updatedRecords.length,
      updatedRecords,
    });
  } catch (error: any) {
    console.error("Error fixing admission dates:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fix admission dates" },
      { status: 500 }
    );
  }
}
