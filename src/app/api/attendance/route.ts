import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Attendance from "@/models/Attendance";
import Batch from "@/models/Batch";
import Admission from "@/models/Admission";
import Enquiry from "@/models/Enquiry";

import { getUserFromCookies } from "@/lib/helper";

export async function GET(request: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId");
    const batchName = searchParams.get("batchName");
    const dateStr = searchParams.get("dateStr");
    const teacherId = searchParams.get("teacherId");
    let brand = searchParams.get("brand");
    const getRosterOnly = searchParams.get("rosterOnly");

    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    const isBrandRestricted = userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";

    if (isBrandRestricted) {
      brand = userBrand;
    }

    // If rosterOnly flag is passed, fetch enrolled students for the specified batch
    if (getRosterOnly === "true" && (batchId || batchName)) {
      let targetBatchName = batchName;
      let targetCourse = "";

      let customBatchId = "";
      if (batchId) {
        try {
          const bQuery: any[] = [{ batchId: batchId }];
          if (mongoose.Types.ObjectId.isValid(batchId)) {
            bQuery.push({ _id: new mongoose.Types.ObjectId(batchId) });
          }
          const batchObj = await Batch.findOne({ $or: bQuery }).lean();
          if (batchObj) {
            targetBatchName = batchObj.batchName;
            targetCourse = batchObj.course || "";
            customBatchId = batchObj.batchId || "";
          }
        } catch (_) {}
      }

      // Build strict match queries for batch assignment
      const batchOrQuery: any[] = [];
      if (batchId) {
        batchOrQuery.push({ batchId: batchId });
      }
      if (customBatchId && customBatchId !== batchId) {
        batchOrQuery.push({ batchId: customBatchId });
      }
      if (targetBatchName) {
        batchOrQuery.push({ batch: targetBatchName.trim() });
      }

      let admissions: any[] = [];
      if (batchOrQuery.length > 0) {
        admissions = await Admission.find({
          $or: batchOrQuery
        }).select("fullName studentFullName mobileNumber phone email admissionId batch batchId course").lean();
      }

      let studentRoster = admissions.map((a: any) => ({
        studentName: a.fullName || a.studentFullName || "Student",
        admissionId: a.admissionId || `ADM-${a._id.toString().slice(-6).toUpperCase()}`,
        mobileNumber: a.mobileNumber || a.phone || "",
        status: "Present",
        remarks: ""
      }));

      // Check Enquiry ONLY if enquiry has this specific batch explicitly assigned
      if (studentRoster.length === 0 && (batchId || targetBatchName)) {
        const enquiryBatchQuery: any[] = [];
        if (batchId) enquiryBatchQuery.push({ batchId: batchId });
        if (customBatchId) enquiryBatchQuery.push({ batchId: customBatchId });
        if (targetBatchName) {
          enquiryBatchQuery.push({ batch: targetBatchName.trim() });
        }

        const batchEnquiries = await Enquiry.find({
          status: { $in: ["Admitted", "Enrolled", "Demo Attended"] },
          $or: enquiryBatchQuery
        }).select("studentFullName primaryPhoneMobile targetCourse enquiryId batch batchId").lean();

        if (batchEnquiries.length > 0) {
          studentRoster = batchEnquiries.map((e: any) => ({
            studentName: e.studentFullName || "Student",
            admissionId: e.enquiryId || `ENQ-${e._id.toString().slice(-6).toUpperCase()}`,
            mobileNumber: e.primaryPhoneMobile || "",
            status: "Present",
            remarks: ""
          }));
        }
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
