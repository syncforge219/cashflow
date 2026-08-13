import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Task from "@/models/Task";

export async function POST(req: Request) {
  try {
    await dbConnect();
    
    const body = await req.json();
    const { studentId, customEmiPlan } = body;

    if (!studentId || !customEmiPlan) {
      return NextResponse.json(
        { success: false, message: "Student ID and customEmiPlan are required" },
        { status: 400 }
      );
    }

    const formattedPlan = Array.isArray(customEmiPlan)
      ? customEmiPlan.map((item: any) => ({
          ...item,
          dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
          amount: Number(item.amount) || 0,
          isPaid: Boolean(item.isPaid),
          paidDate: item.isPaid ? (item.paidDate ? new Date(item.paidDate) : new Date()) : null,
        }))
      : [];

    const unpaidSum = formattedPlan
      .filter((e: any) => !e.isPaid)
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

    const admFilter = mongoose.Types.ObjectId.isValid(studentId)
      ? { _id: studentId }
      : { admissionId: studentId };

    const admission = await Admission.findOneAndUpdate(
      admFilter,
      { customEmiPlan: formattedPlan, remainingBalance: unpaidSum },
      { new: true }
    );

    if (!admission) {
      return NextResponse.json(
        { success: false, message: "Student not found" },
        { status: 404 }
      );
    }

    if (unpaidSum === 0) {
      try {
        await Task.updateMany(
          {
            $or: [
              { linkedStudentId: studentId },
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
        console.error("Failed to complete fee tasks on custom-emi update:", taskErr);
      }
    }

    return NextResponse.json({ success: true, data: admission });
  } catch (error) {
    console.error("Error updating custom EMI plan:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
