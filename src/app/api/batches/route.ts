import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Batch from "@/models/Batch";
import User from "@/models/User";
import { getUserFromCookies } from "@/lib/helper";
import { computeBatchStatus } from "@/lib/batchHelper";

export async function GET(request: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const { searchParams } = new URL(request.url);
    let brand = searchParams.get("brand");
    let teacherId = searchParams.get("teacherId");
    const status = searchParams.get("status");
    const course = searchParams.get("course");
    const all = searchParams.get("all");

    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    const isBrandRestricted = userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";

    if (isBrandRestricted) {
      brand = userBrand;
    }

    // Automatically restrict to logged-in teacher's batches if role is teacher/faculty and all!=true
    if (!teacherId && user && (user.role === "teacher" || user.role === "faculty") && all !== "true") {
      teacherId = user._id ? user._id.toString() : ((user as any)?.id || "");
    }

    const query: any = {};
    if (brand && brand !== "All Brands" && brand !== "All") {
      query.brand = { $regex: new RegExp(`^${brand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") };
    }

    if (teacherId) {
      let teacherName = user?.name;
      if (user?._id?.toString() !== teacherId && (user as any)?.id !== teacherId) {
        try {
          if (mongoose.Types.ObjectId.isValid(teacherId)) {
            const teacherUser = await User.findById(teacherId).lean();
            if (teacherUser) teacherName = teacherUser.name;
          }
        } catch (_) {}
      }

      const teacherOrConditions: any[] = [{ teacherId: teacherId }];
      if (teacherName) {
        teacherOrConditions.push({
          teacherName: { $regex: new RegExp(`^${teacherName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") }
        });
      }
      query.$or = teacherOrConditions;
    }

    if (status && status !== "All Status") {
      query.status = status;
    }

    if (course) {
      const cRegex = new RegExp(course.trim(), "i");
      const courseQuery = [{ course: { $regex: cRegex } }, { courses: { $regex: cRegex } }];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: courseQuery }];
        delete query.$or;
      } else {
        query.$or = courseQuery;
      }
    }

    const batchIdParam = searchParams.get("batchId");

    if (batchIdParam) {
      const trimmedBId = batchIdParam.trim();
      const bQuery: any[] = [{ batchId: trimmedBId }];
      if (mongoose.Types.ObjectId.isValid(trimmedBId)) {
        bQuery.push({ _id: new mongoose.Types.ObjectId(trimmedBId) });
      }
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: bQuery }];
        delete query.$or;
      } else {
        query.$or = bQuery;
      }
    }

    let batches = await Batch.find(query).sort({ createdAt: -1 }).lean();

    // Auto-migrate batch IDs and synchronize dynamic batch status lifecycle (Upcoming -> Active -> Completed)
    const updatePromises: Promise<any>[] = [];

    for (let i = 0; i < batches.length; i++) {
      const b = batches[i];
      let needsDbUpdate = false;
      const updates: any = {};

      if (!b.batchId) {
        const lastBatchWithId = await Batch.findOne({ batchId: /^BAT\d+$/ }).sort({ batchId: -1 });
        let nextNum = 1;
        if (lastBatchWithId && lastBatchWithId.batchId) {
          const match = lastBatchWithId.batchId.match(/^BAT(\d+)$/);
          if (match) nextNum = parseInt(match[1], 10) + 1;
        }
        const genId = `BAT${String(nextNum).padStart(6, "0")}`;
        updates.batchId = genId;
        batches[i].batchId = genId;
        needsDbUpdate = true;
      }

      const calculatedStatus = computeBatchStatus(b.startDate, b.endDate, b.status);
      if (calculatedStatus !== b.status && b.status !== "Cancelled") {
        updates.status = calculatedStatus;
        batches[i].status = calculatedStatus;
        needsDbUpdate = true;
      }

      if (needsDbUpdate) {
        updatePromises.push(Batch.findByIdAndUpdate(b._id, updates));
      }
    }

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    // If a specific status filter was requested in query, re-filter in memory to guarantee synced statuses match
    if (status && status !== "All Status") {
      batches = batches.filter((b) => b.status === status);
    }

    // Attach enrolled student counts to each batch
    try {
      const Enquiry = (await import("@/models/Enquiry")).default;
      const Attendance = (await import("@/models/Attendance")).default;

      for (let i = 0; i < batches.length; i++) {
        const b = batches[i] as any;
        const bIdStr = b._id ? b._id.toString() : "";
        const bCustomId = b.batchId || "";
        const bName = b.batchName || "";

        const enrolledInDb = await Enquiry.countDocuments({
          $or: [
            { batchId: bIdStr },
            { batchId: bCustomId },
            { batch: bName },
            { assignedBatch: bName }
          ]
        });

        const latestAttendanceLog = await Attendance.findOne({
          $or: [{ batchId: bIdStr }, { batchId: bCustomId }, { batchName: bName }]
        }).sort({ date: -1 }).lean();

        const logStudentCount = (latestAttendanceLog as any)?.totalStudents || 0;
        const arrayCount = Array.isArray(b.students) ? b.students.length : 0;

        (batches[i] as any).enrolledStudentsCount = Math.max(
          enrolledInDb,
          logStudentCount,
          arrayCount,
          Number(b.enrolledStudentsCount || b.studentsCount || 0)
        );
      }
    } catch (e) {
      console.error("Error calculating batch student counts:", e);
    }

    return NextResponse.json({
      success: true,
      count: batches.length,
      data: batches,
      batches,
    });
  } catch (error: any) {
    console.error("GET /api/batches Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch batches" },
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
      courses,
      courseCode,
      teacherId,
      teacherName,
      brand,
      startDate,
      endDate,
      timing,
      days,
      maxCapacity,
      notes,
      createdBy,
      creatorRole,
    } = body;

    const coursesArr: string[] = Array.isArray(courses) && courses.length > 0
      ? courses.map((c: any) => String(c).trim()).filter(Boolean)
      : (course ? [String(course).trim()] : []);

    const courseStr = course ? String(course).trim() : coursesArr.join(", ");

    if (!batchName || (coursesArr.length === 0 && !courseStr) || !teacherId || !brand || !startDate || !timing) {
      return NextResponse.json(
        {
          success: false,
          error: "Batch Name, Course(s), Faculty, Brand, Start Date, and Timing are required.",
        },
        { status: 400 }
      );
    }

    // Verify assigned teacher exists
    let assignedFacultyName = teacherName;
    if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) {
      const teacher = await User.findById(teacherId);
      if (teacher) {
        assignedFacultyName = teacher.name;
      }
    }

    // Auto-generate unique batchId if not provided
    let finalBatchId = batchId?.trim();
    if (!finalBatchId) {
      const lastBatchWithId = await Batch.findOne({ batchId: /^BAT\d+$/ }).sort({ batchId: -1 });
      let nextNum = 1;
      if (lastBatchWithId && lastBatchWithId.batchId) {
        const match = lastBatchWithId.batchId.match(/^BAT(\d+)$/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }
      finalBatchId = `BAT${String(nextNum).padStart(6, "0")}`;
    }

    const initialStatus = computeBatchStatus(startDate, endDate);

    const newBatch = await Batch.create({
      batchId: finalBatchId,
      batchName: batchName.trim(),
      course: courseStr,
      courses: coursesArr,
      courseCode: courseCode?.trim() || undefined,
      teacherId,
      teacherName: assignedFacultyName || "Unassigned Faculty",
      brand,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      timing,
      days: Array.isArray(days) ? days : [days].filter(Boolean),
      maxCapacity: Number(maxCapacity) || 30,
      notes,
      createdBy: createdBy || "System User",
      creatorRole: creatorRole || "super admin",
      status: initialStatus,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Faculty batch created successfully",
        data: newBatch,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/batches Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create batch" },
      { status: 500 }
    );
  }
}
