import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Attendance from "@/models/Attendance";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const log = await Attendance.findById(id).lean();

    if (!log) {
      return NextResponse.json(
        { success: false, error: "Attendance record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: log });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch record" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await request.json();

    if (Array.isArray(body.records)) {
      let totalPresent = 0;
      let totalAbsent = 0;
      let totalLate = 0;
      let totalExcused = 0;

      body.records.forEach((rec: any) => {
        if (rec.status === "Present") totalPresent++;
        else if (rec.status === "Absent") totalAbsent++;
        else if (rec.status === "Late") totalLate++;
        else if (rec.status === "Excused") totalExcused++;
      });

      body.totalStudents = body.records.length;
      body.totalPresent = totalPresent;
      body.totalAbsent = totalAbsent;
      body.totalLate = totalLate;
      body.totalExcused = totalExcused;
    }

    const updatedLog = await Attendance.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!updatedLog) {
      return NextResponse.json(
        { success: false, error: "Attendance record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Attendance record updated",
      data: updatedLog,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update record" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const deletedLog = await Attendance.findByIdAndDelete(id);

    if (!deletedLog) {
      return NextResponse.json(
        { success: false, error: "Attendance record not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Attendance record deleted",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete record" },
      { status: 500 }
    );
  }
}
