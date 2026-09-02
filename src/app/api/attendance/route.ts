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

    // If rosterOnly flag is passed, fetch enrolled students strictly for the specified batchId
    if (getRosterOnly === "true") {
      if (!batchId) {
        return NextResponse.json({
          success: true,
          count: 0,
          roster: [],
        });
      }

      const trimmedBatchId = batchId.trim();
      const batchIdOrQuery: any[] = [{ batchId: trimmedBatchId }];
      if (mongoose.Types.ObjectId.isValid(trimmedBatchId)) {
        batchIdOrQuery.push({ batchId: trimmedBatchId });
      }

      let batchObj: any = null;
      try {
        const bQuery: any[] = [{ batchId: trimmedBatchId }];
        if (mongoose.Types.ObjectId.isValid(trimmedBatchId)) {
          bQuery.push({ _id: new mongoose.Types.ObjectId(trimmedBatchId) });
        }
        batchObj = await Batch.findOne({ $or: bQuery }).lean();
        if (batchObj) {
          if (batchObj.batchId && batchObj.batchId !== trimmedBatchId) {
            batchIdOrQuery.push({ batchId: batchObj.batchId });
          }
          if (batchObj._id && batchObj._id.toString() !== trimmedBatchId) {
            batchIdOrQuery.push({ batchId: batchObj._id.toString() });
          }
        }
      } catch (_) {}

      let admissions = await Admission.find({
        $or: batchIdOrQuery
      }).select("fullName studentFullName mobileNumber phone email admissionId batch batchId course").lean();

      // If no admissions found by explicit batchId, only check legacy batchName if EXACTLY 1 batch exists with this name.
      // If multiple batches share the same name (e.g. BAT000016, BAT000021, BAT000022 all named 'Autocad'),
      // DO NOT auto-link or assign across them!
      if (admissions.length === 0 && batchObj && batchObj.batchName) {
        const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const matchingCount = await Batch.countDocuments({
          batchName: { $regex: new RegExp(`^${escapeRegExp(batchObj.batchName.trim())}$`, "i") }
        });

        if (matchingCount === 1) {
          const legacyAdmissions = await Admission.find({
            batch: { $regex: new RegExp(`^${escapeRegExp(batchObj.batchName.trim())}$`, "i") },
            $or: [{ batchId: { $exists: false } }, { batchId: "" }, { batchId: null }]
          }).select("fullName studentFullName mobileNumber phone email admissionId batch batchId course").lean();

          if (legacyAdmissions.length > 0) {
            admissions = legacyAdmissions;
          }
        }
      }

      let studentRoster = admissions.map((a: any) => ({
        studentName: a.fullName || a.studentFullName || "Student",
        admissionId: a.admissionId || `ADM-${a._id.toString().slice(-6).toUpperCase()}`,
        mobileNumber: a.mobileNumber || a.phone || "",
        status: "Present",
        remarks: ""
      }));

      // Check Enquiry ONLY if enquiry has this specific batchId explicitly assigned
      if (studentRoster.length === 0) {
        const batchEnquiries = await Enquiry.find({
          status: { $in: ["Admitted", "Enrolled", "Demo Attended"] },
          $or: batchIdOrQuery
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

      // Check Attendance collection strictly for this batch if roster is still empty
      if (studentRoster.length === 0) {
        const attQuery: any[] = [];
        if (batchObj && batchObj._id) {
          attQuery.push({ batchId: batchObj._id });
        }
        if (mongoose.Types.ObjectId.isValid(trimmedBatchId)) {
          attQuery.push({ batchId: new mongoose.Types.ObjectId(trimmedBatchId) });
        }

        if (attQuery.length > 0) {
          const attendanceLogs = await Attendance.find({
            $or: attQuery
          }).sort({ date: -1 }).limit(10).lean();

          const studentMap = new Map<string, any>();
          attendanceLogs.forEach((att: any) => {
            (att.records || []).forEach((r: any) => {
              const key = (r.admissionId || r.mobileNumber || r.studentName || "").trim().toLowerCase();
              if (key && !studentMap.has(key)) {
                studentMap.set(key, {
                  studentName: r.studentName || "Student",
                  admissionId: r.admissionId || "ADM-N/A",
                  mobileNumber: r.mobileNumber || "",
                  status: "Present",
                  remarks: ""
                });
              }
            });
          });

          if (studentMap.size > 0) {
            studentRoster = Array.from(studentMap.values());
          }
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
    if (batchId) {
      if (mongoose.Types.ObjectId.isValid(batchId)) {
        query.batchId = batchId;
      } else {
        const foundBatch = await Batch.findOne({ batchId: batchId.trim() }).lean();
        if (foundBatch && foundBatch._id) {
          query.batchId = foundBatch._id;
        } else {
          query.batchId = batchId;
        }
      }
    }
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

    let finalBatchMongoId = batchId;
    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      const foundBatch = await Batch.findOne({ batchId: batchId.trim() }).lean();
      if (foundBatch && foundBatch._id) {
        finalBatchMongoId = foundBatch._id;
      }
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
      { batchId: finalBatchMongoId, dateStr },
      {
        batchId: finalBatchMongoId,
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
