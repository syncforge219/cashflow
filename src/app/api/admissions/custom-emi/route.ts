import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Task from "@/models/Task";
import { recomputeAndStoreAdmissionBalance } from "@/lib/studentBalanceService";
import { buildFeeSchedule, syncCustomPlanFlags } from "@/lib/feeSchedule";
import { parseDateOnly } from "@/lib/dates";

/**
 * Saves an edited EMI plan (amounts + due dates).
 * The student's balance is NOT taken from the plan: it is always fee minus actual payments.
 * (Previously the balance was overwritten with the plan's unpaid total, which dropped any
 * down payment still owed and drifted from the payments ledger.)
 */
export async function POST(req: Request) {
  try {
    await dbConnect();

    const body = await req.json();
    const { studentId, customEmiPlan } = body;

    if (!studentId || !Array.isArray(customEmiPlan)) {
      return NextResponse.json(
        { success: false, message: "Student ID and customEmiPlan are required" },
        { status: 400 }
      );
    }

    const formattedPlan: any[] = [];
    for (const [i, item] of customEmiPlan.entries()) {
      const amount = Number(item?.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return NextResponse.json({ success: false, message: `Installment ${i + 1}: invalid amount.` }, { status: 400 });
      }
      const dueDate = parseDateOnly(item?.dueDate);
      if (!dueDate) {
        return NextResponse.json({ success: false, message: `Installment ${i + 1}: invalid due date.` }, { status: 400 });
      }
      formattedPlan.push({
        ...(item?.installmentName ? { installmentName: String(item.installmentName) } : {}),
        dueDate,
        amount: Math.round(amount * 100) / 100,
        isPaid: false,
        paidDate: item?.paidDate ? parseDateOnly(item.paidDate) : null,
      });
    }

    const admFilter = mongoose.Types.ObjectId.isValid(studentId) ? { _id: studentId } : { admissionId: studentId };
    const admission: any = await Admission.findOne(admFilter);
    if (!admission) {
      return NextResponse.json({ success: false, message: "Student not found" }, { status: 404 });
    }

    admission.customEmiPlan = formattedPlan;
    admission.numInstallments = formattedPlan.length || admission.numInstallments;
    if (formattedPlan.length > 0) admission.hasEmi = true;
    await admission.save();

    // Balance from the payments ledger, then mark instalments paid/unpaid from it
    const balance = await recomputeAndStoreAdmissionBalance(admission._id);
    const fresh: any = await Admission.findById(admission._id);
    const schedule = buildFeeSchedule(fresh, { totalPaid: balance.totalPaid, totalFee: balance.finalFee });
    if (syncCustomPlanFlags(fresh.customEmiPlan, schedule)) {
      fresh.markModified("customEmiPlan");
      await fresh.save();
    }

    if (balance.remainingBalance === 0) {
      try {
        await Task.updateMany(
          {
            $or: [{ linkedStudentId: String(admission._id) }, { linkedStudentName: admission.fullName }],
            taskType: { $in: ["Fee Follow-up", "Fee Collection", "EMI Recovery", "Follow-up"] },
            status: { $in: ["Pending", "In Progress"] },
          },
          { $set: { status: "Completed", completedAt: new Date() } }
        );
      } catch (taskErr) {
        console.error("Failed to complete fee tasks on custom-emi update:", taskErr);
      }
    }

    return NextResponse.json({ success: true, data: fresh });
  } catch (error) {
    console.error("Error updating custom EMI plan:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}
