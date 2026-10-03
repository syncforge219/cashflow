import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Payment from "@/models/Payment";
import Admission from "@/models/Admission";
import Company from "@/models/Company";
import { getFinancialYear, getFinancialYearRange } from "@/lib/financialYearHelper";
import { recomputeAndStoreAdmissionBalance } from "@/lib/studentBalanceService";
import { getUserFromCookies } from "@/lib/helper";
import { logAuditEntry } from "@/lib/auditLogger";
import { withOptionalTransaction } from "@/lib/transactionHelper";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, message: "Payment ID required" }, { status: 400 });
    }

    const payment = await Payment.findById(id).lean();
    if (!payment) {
      return NextResponse.json({ success: false, message: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: payment });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, message: "Payment ID required" }, { status: 400 });
    }

    const payment: any = await Payment.findById(id);
    if (!payment) {
      return NextResponse.json({ success: false, message: "Payment not found" }, { status: 404 });
    }

    const deletedAmount = Number(payment.amountReceived) || 0;
    const paymentCompany = (payment.company || "").trim();
    const admissionId = payment.admissionId;
    const receiptNo = payment.receiptNo || "N/A";

    const user = await getUserFromCookies();
    const userId = (user as any)?._id || null;

    // Delete payment and recompute admission balance inside optional transaction (with standalone fallback)
    let updatedAdmission: any = null;
    await withOptionalTransaction(async (session) => {
      payment.isDeleted = true;
      payment.deletedAt = new Date();
      payment.deletedBy = userId;
      await payment.save({ session });

      if (admissionId) {
        await recomputeAndStoreAdmissionBalance(admissionId, session);
        updatedAdmission = await Admission.findById(admissionId).session(session);

        if (updatedAdmission && Array.isArray(updatedAdmission.customEmiPlan) && updatedAdmission.customEmiPlan.length > 0) {
          const paidEmis = updatedAdmission.customEmiPlan.filter((emi: any) => emi.isPaid);
          if (paidEmis.length > 0) {
            const matchingEmi = paidEmis.reverse().find((emi: any) => Number(emi.amount) === deletedAmount) || paidEmis[0];
            if (matchingEmi) {
              matchingEmi.isPaid = false;
              matchingEmi.paidDate = null;
              await updatedAdmission.save({ session });
            }
          }
        }
      }
    });

    // Reverse Company Collection if company is valid
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

      let compDoc = payment.companyId ? await Company.findById(payment.companyId) : null;
      if (!compDoc) {
        compDoc = await Company.findOne({
          $or: [{ name: { $regex: compRegex } }, { legalName: { $regex: compRegex } }]
        });
      }
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
    console.error("Error deleting payment in dynamic route:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
