import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";

export async function GET() {
  try {
    await dbConnect();

    // Find all admissions where downpaymentAmount > 0 and registrationAmount is present
    const admissions = await Admission.find({
      downpaymentAmount: { $gt: 0 },
      registrationAmount: { $gt: 0 }
    });

    const reconciled: any[] = [];

    for (const adm of admissions) {
      const payments = await Payment.find({ admissionId: adm._id }).sort({ createdAt: 1 });
      const regAmt = Number(adm.registrationAmount) || 0;
      const dpAmt = Number(adm.downpaymentAmount) || 0;
      const inflatedSum = regAmt + dpAmt;

      // If only 1 initial payment exists and its amount equals regAmt + dpAmt
      if (payments.length === 1 && Number(payments[0].amountReceived) === inflatedSum) {
        const p = payments[0];
        await Payment.updateOne(
          { _id: p._id },
          { $set: { amountReceived: regAmt, remarks: "Initial registration payment upon admission" } }
        );

        const correctBal = Math.max(0, Number(adm.finalFee || adm.courseFee || 0) - regAmt);
        await Admission.updateOne(
          { _id: adm._id },
          { $set: { remainingBalance: correctBal, amountReceivedToday: regAmt } }
        );

        reconciled.push({
          studentName: adm.fullName,
          admissionId: adm.admissionId,
          receiptNo: p.receiptNo,
          correctedAmount: regAmt,
          previousAmount: inflatedSum,
          downpaymentScheduled: dpAmt,
          remainingBalance: correctBal
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reconciled ${reconciled.length} student payment records.`,
      reconciled
    });
  } catch (err: any) {
    console.error("Error in reconcile-collections:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
