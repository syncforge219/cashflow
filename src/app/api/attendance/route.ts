import { toDateKey } from "@/lib/dates";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Attendance from "@/models/Attendance";
import Batch from "@/models/Batch";
import Admission from "@/models/Admission";
import Enquiry from "@/models/Enquiry";

import { getUserFromCookies, escapeRegex as escapeRegexSafe } from "@/lib/helper";
import { canTakeAnyAttendance, findBatchByAnyId, userCanUseBrand } from "@/lib/batchRules";
import { computeBatchStatus, isBatchActiveOnDate } from "@/lib/batchHelper";

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

      // Look up target batch by custom batchId or _id
      const bLookup: any[] = [{ batchId: trimmedBatchId }];
      if (mongoose.Types.ObjectId.isValid(trimmedBatchId)) {
        bLookup.push({ _id: new mongoose.Types.ObjectId(trimmedBatchId) });
      }
      let batchObj: any = await Batch.findOne({ $or: bLookup }).lean();
      if (!batchObj && batchName) {
        const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        batchObj = await Batch.findOne({
          batchName: { $regex: new RegExp(`^${escapeRegExp(batchName.trim())}$`, "i") }
        }).lean();
      }

      // Build explicit match conditions for this batch (NEVER match null or empty)
      const batchIdConditions: any[] = [];
      if (trimmedBatchId && trimmedBatchId !== "null" && trimmedBatchId !== "undefined") {
        batchIdConditions.push({ batchId: trimmedBatchId });
        if (mongoose.Types.ObjectId.isValid(trimmedBatchId)) {
          batchIdConditions.push({ batchId: new mongoose.Types.ObjectId(trimmedBatchId) });
        }
      }

      if (batchObj) {
        if (batchObj.batchId && batchObj.batchId !== trimmedBatchId) {
          batchIdConditions.push({ batchId: batchObj.batchId });
        }
        if (batchObj._id) {
          batchIdConditions.push({ batchId: batchObj._id });
          batchIdConditions.push({ batchId: batchObj._id.toString() });
        }
      }

      const activeStatusFilter = { $nin: ["Cancelled", "Refunded", "Dropped", "Transferred"] };
      const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // 1. Direct query strictly for students assigned to this batch
      let admissions: any[] = [];
      if (batchIdConditions.length > 0) {
        const directMatch: any = {
          $or: batchIdConditions,
          status: activeStatusFilter,
        };
        if (batchObj?.brand) {
          directMatch.brand = { $regex: new RegExp(`^${escapeRegExp(batchObj.brand.trim())}$`, "i") };
        }

        admissions = await Admission.find(directMatch)
          .select("fullName studentFullName mobileNumber phone email admissionId batch batchId course")
          .lean();

        // If brand filter yielded 0, try without brand filter in case admission brand was unassigned
        if (admissions.length === 0) {
          admissions = await Admission.find({
            $or: batchIdConditions,
            status: activeStatusFilter,
          })
            .select("fullName studentFullName mobileNumber phone email admissionId batch batchId course")
            .lean();
        }
      }

      let studentRoster = admissions.map((a: any) => ({
        studentName: a.fullName || a.studentFullName || "Student",
        admissionId: a.admissionId || `ADM-${a._id.toString().slice(-6).toUpperCase()}`,
        mobileNumber: a.mobileNumber || a.phone || "",
        status: "Present",
        remarks: ""
      }));

      // 2. Check Enquiry ONLY if enquiry has this specific batchId explicitly assigned
      if (studentRoster.length === 0 && batchIdConditions.length > 0) {
        const batchEnquiries = await Enquiry.find({
          status: { $in: ["Admitted", "Enrolled", "Demo Attended"] },
          $or: batchIdConditions
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

      // 3. Check Attendance collection strictly for this batch if roster is still empty
      if (studentRoster.length === 0 && batchIdConditions.length > 0) {
        // Raw collection query: the model casts batchId to ObjectId and threw on the BATxxxxxx code form
        const attendanceLogs = await Attendance.collection
          .find({ $or: batchIdConditions })
          .sort({ date: -1 })
          .limit(10)
          .toArray();

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

      // 4. Only if STILL 0 and batch has batchName, check legacy unassigned records
      // BUT strictly scoped to the exact same brand AND course
      if (studentRoster.length === 0 && batchObj && batchObj.batchName && batchObj.course && batchObj.brand) {
        const matchingCount = await Batch.countDocuments({
          batchName: { $regex: new RegExp(`^${escapeRegExp(batchObj.batchName.trim())}$`, "i") }
        });

        if (matchingCount === 1) {
          const legacyQuery: any = {
            batch: { $regex: new RegExp(`^${escapeRegExp(batchObj.batchName.trim())}$`, "i") },
            $or: [{ batchId: { $exists: false } }, { batchId: "" }, { batchId: null }],
            status: activeStatusFilter,
            brand: { $regex: new RegExp(`^${escapeRegExp(batchObj.brand.trim())}$`, "i") },
            course: { $regex: new RegExp(`^${escapeRegExp(batchObj.course.trim())}$`, "i") }
          };
          const legacyAdmissions = await Admission.find(legacyQuery)
            .select("fullName studentFullName mobileNumber phone email admissionId batch batchId course").lean();

          if (legacyAdmissions.length > 0) {
            studentRoster = legacyAdmissions.map((a: any) => ({
              studentName: a.fullName || a.studentFullName || "Student",
              admissionId: a.admissionId || `ADM-${a._id.toString().slice(-6).toUpperCase()}`,
              mobileNumber: a.mobileNumber || a.phone || "",
              status: "Present",
              remarks: ""
            }));
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
    if (batchName) query.batchName = { $regex: new RegExp(`^${escapeRegexSafe(batchName.trim())}$`, "i") };
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

const ATTENDANCE_STATUSES = ["Present", "Absent", "Late", "Excused"];
const DAY_BY_INDEX = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function POST(request: Request) {
  try {
    await dbConnect();
    const user: any = await getUserFromCookies();
    if (!user) return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
    const body = await request.json();
    const { batchId, date, records, notes, course, extraClass } = body;

    if (!batchId || !date || !Array.isArray(records)) {
      return NextResponse.json({ success: false, error: "Batch, Date and Student Records are required." }, { status: 400 });
    }

    // The batch comes from the database; its name, brand and course are never taken from the request
    const batch: any = await findBatchByAnyId(batchId);
    if (!batch) return NextResponse.json({ success: false, error: "Batch not found." }, { status: 404 });
    if (!userCanUseBrand(user, batch.brand)) {
      return NextResponse.json({ success: false, error: "Batch not found." }, { status: 404 });
    }

    // Only the batch's own teacher, or a manager / admin, may take attendance
    const isOwnTeacher = String(batch.teacherId) === String(user._id || user.id);
    if (!isOwnTeacher && !canTakeAnyAttendance(user.role)) {
      return NextResponse.json({ success: false, error: "You can only take attendance for your own batches." }, { status: 403 });
    }

    const dateObj = new Date(date);
    if (Number.isNaN(dateObj.getTime())) {
      return NextResponse.json({ success: false, error: "Date is not valid." }, { status: 400 });
    }
    const dateStr = toDateKey(dateObj);
    if (dateStr > toDateKey(new Date())) {
      return NextResponse.json({ success: false, error: "Attendance can't be taken for a future date." }, { status: 400 });
    }

    const status = computeBatchStatus(batch.startDate, batch.endDate, batch.status, new Date(), batch.statusLocked);
    if (status === "Cancelled") {
      return NextResponse.json({ success: false, error: "This batch is cancelled." }, { status: 409 });
    }
    // Inside the batch's start / end dates
    if (!isBatchActiveOnDate(batch, dateStr)) {
      return NextResponse.json({ success: false, error: "That date is outside this batch's start and end dates." }, { status: 400 });
    }
    // On one of the batch's class days, unless it is flagged as an extra / make-up class
    const dayOfWeek = DAY_BY_INDEX[new Date(`${dateStr}T12:00:00+05:30`).getUTCDay()];
    if (!extraClass && !isBatchActiveOnDate(batch, dateStr, dayOfWeek)) {
      return NextResponse.json(
        { success: false, error: `${dayOfWeek} is not a class day for this batch. Mark it as an extra class to continue.` },
        { status: 400 }
      );
    }

    if (records.length > 1000) {
      return NextResponse.json({ success: false, error: "Too many student records." }, { status: 400 });
    }
    const seen = new Set<string>();
    for (const rec of records) {
      if (!ATTENDANCE_STATUSES.includes(rec?.status)) {
        return NextResponse.json({ success: false, error: `Invalid attendance status "${rec?.status}".` }, { status: 400 });
      }
      const key = String(rec.admissionId || rec.studentId || rec.studentName || "");
      if (key) {
        if (seen.has(key)) return NextResponse.json({ success: false, error: `Student ${key} is listed twice.` }, { status: 400 });
        seen.add(key);
      }
    }

    const count = (s: string) => records.filter((r: any) => r.status === s).length;

    // Upsert (update if attendance already taken for this batch & date, else create)
    const attendanceDoc = await Attendance.findOneAndUpdate(
      { batchId: batch._id, dateStr },
      {
        batchId: batch._id,
        batchName: batch.batchName,
        course: batch.course || course || "",
        date: dateObj,
        dateStr,
        // Who took it comes from the session
        teacherId: user._id || user.id,
        teacherName: user.name || batch.teacherName,
        brand: batch.brand || "",
        records,
        totalStudents: records.length,
        totalPresent: count("Present"),
        totalAbsent: count("Absent"),
        totalLate: count("Late"),
        totalExcused: count("Excused"),
        notes: typeof notes === "string" ? notes : "",
      },
      { upsert: true, new: true, runValidators: true }
    );

    return NextResponse.json({ success: true, message: "Attendance saved successfully", data: attendanceDoc }, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/attendance Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to save attendance" }, { status: 500 });
  }
}
