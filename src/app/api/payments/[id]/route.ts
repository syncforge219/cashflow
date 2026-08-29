import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Payment from "@/models/Payment";
import Admission from "@/models/Admission";
import Company from "@/models/Company";

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

    const payment = await Payment.findById(id);
    if (!payment) {
      return NextResponse.json({ success: false, message: "Payment not found" }, { status: 404 });
    }

    const deletedAmount = Number(payment.amountReceived) || 0;
    const paymentCompany = (payment.company || "").trim();
    const admissionId = payment.admissionId;
    const receiptNo = payment.receiptNo || "N/A";

    await Payment.findByIdAndDelete(id);

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

      const compDoc = await Company.findOneAndUpdate(
        { $or: [{ name: { $regex: compRegex } }, { legalName: { $regex: compRegex } }] },
        { $inc: { collectedRevenue: -deletedAmount } },
        { new: true }
      );
      if (compDoc) reversedCompany = compDoc.name;
    }

    // Recalculate student admission record
    let updatedAdmission: any = null;
    if (admissionId) {
      const admission = await Admission.findById(admissionId);
      if (admission) {
        const remainingPayments = await Payment.find({ admissionId: admission._id });
        const newTotalPaid = remainingPayments.reduce(
          (sum: number, p: any) => sum + (Number(p.amountReceived) || 0),
          0
        );

        const totalAgreedFee = Number(admission.finalFee) > 0
          ? Number(admission.finalFee)
          : (Number(admission.courseFee) || 0);

        admission.remainingBalance = Math.max(0, totalAgreedFee - newTotalPaid);

        if (remainingPayments.length === 0) {
          admission.amountReceivedToday = 0;
          admission.registrationAmount = 0;
        } else {
          if (Number(admission.registrationAmount) > newTotalPaid) {
            admission.registrationAmount = newTotalPaid;
          }
          if (Number(admission.amountReceivedToday) > newTotalPaid) {
            admission.amountReceivedToday = newTotalPaid;
          }
        }

        if (Array.isArray(admission.customEmiPlan) && admission.customEmiPlan.length > 0) {
          const paidEmis = admission.customEmiPlan.filter((emi: any) => emi.isPaid);
          if (paidEmis.length > 0) {
            const matchingEmi = paidEmis.reverse().find((emi: any) => Number(emi.amount) === deletedAmount) || paidEmis[0];
            if (matchingEmi) {
              matchingEmi.isPaid = false;
              matchingEmi.paidDate = null;
            }
          }
        }

        await admission.save();
        updatedAdmission = admission;
      }
    }

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
