import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Attendance from "@/models/Attendance";
import Batch from "@/models/Batch";
import Admission from "@/models/Admission";
import Enquiry from "@/models/Enquiry";

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId");
    const batchName = searchParams.get("batchName");
    const dateStr = searchParams.get("dateStr");
    const teacherId = searchParams.get("teacherId");
    const brand = searchParams.get("brand");
    const getRosterOnly = searchParams.get("rosterOnly");

    // If rosterOnly flag is passed, fetch enrolled students for the specified batch
    if (getRosterOnly === "true" && (batchId || batchName)) {
      let targetBatchName = batchName;
      let targetCourse = "";

      if (batchId && !targetBatchName) {
        const batchObj = await Batch.findById(batchId);
        if (batchObj) {
          targetBatchName = batchObj.batchName;
          targetCourse = batchObj.course;
        }
      }

      // Query admissions for this batch or course
      const admissions = await Admission.find({
        $or: [
          { batch: targetBatchName },
          { course: targetCourse }
        ]
      }).select("fullName mobileNumber email admissionId batch course").lean();

      // Fallback: If no admissions, query enquiries with status "Admitted"
      let studentRoster = admissions.map((a: any) => ({
        studentName: a.fullName,
        admissionId: a.admissionId || `ADM-${a._id.toString().slice(-6).toUpperCase()}`,
        mobileNumber: a.mobileNumber || "",
        status: "Present",
        remarks: ""
      }));

      if (studentRoster.length === 0 && targetCourse) {
        const admittedEnquiries = await Enquiry.find({
          status: { $in: ["Admitted", "Demo Attended"] },
          $or: [
            { targetCourse: targetCourse },
            { targetBrand: brand }
          ]
        }).select("studentFullName primaryPhoneMobile targetCourse enquiryId").lean();

        studentRoster = admittedEnquiries.map((e: any) => ({
          studentName: e.studentFullName || "Student",
          admissionId: e.enquiryId || `ENQ-${e._id.toString().slice(-6).toUpperCase()}`,
          mobileNumber: e.primaryPhoneMobile || "",
          status: "Present",
          remarks: ""
        }));
      }

      return NextResponse.json({
        success: true,
        count: studentRoster.length,
        roster: studentRoster,
      });
    }

    // Otherwise, query attendance records
    const query: any = {};
    if (batchId) query.batchId = batchId;
    if (batchName) query.batchName = { $regex: new RegExp(`^${batchName.trim()}$`, "i") };
    if (dateStr) query.dateStr = dateStr;
    if (teacherId) query.teacherId = teacherId;
    if (brand && brand !== "All Brands") query.brand = brand;

    const logs = await Attendance.find(query).sort({ date: -1 }).lean();

    return NextResponse.json({
      success: true,
      count: logs.length,
      data: logs,
      attendance: logs,
    });
  } catch (error: any) {
    console.error("GET /api/attendance Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch attendance" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();

    const {
      batchId,
      batchName,
      course,
      date,
      teacherId,
      teacherName,
      brand,
      records,
      notes,
    } = body;

    if (!batchId || !batchName || !date || !teacherId || !teacherName || !Array.isArray(records)) {
      return NextResponse.json(
        {
          success: false,
          error: "Batch, Date, Faculty, and Student Records are required.",
        },
        { status: 400 }
      );
    }

    // Normalize dateStr to YYYY-MM-DD
    const dateObj = new Date(date);
    const dateStr = dateObj.toISOString().split("T")[0];

    // Compute totals
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;
    let totalExcused = 0;

    records.forEach((rec: any) => {
      if (rec.status === "Present") totalPresent++;
      else if (rec.status === "Absent") totalAbsent++;
      else if (rec.status === "Late") totalLate++;
      else if (rec.status === "Excused") totalExcused++;
    });

    const totalStudents = records.length;

    // Upsert (update if attendance already taken for this batch & date, else create)
    const attendanceDoc = await Attendance.findOneAndUpdate(
      { batchId, dateStr },
      {
        batchId,
        batchName,
        course: course || "",
        date: dateObj,
        dateStr,
        teacherId,
        teacherName,
        brand: brand || "",
        records,
        totalStudents,
        totalPresent,
        totalAbsent,
        totalLate,
        totalExcused,
        notes: notes || "",
      },
      { upsert: true, new: true, runValidators: true }
    );

    return NextResponse.json(
      {
        success: true,
        message: "Attendance saved successfully",
        data: attendanceDoc,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("POST /api/attendance Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to save attendance" },
      { status: 500 }
    );
  }
}
