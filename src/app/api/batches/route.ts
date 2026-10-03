import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Batch from "@/models/Batch";
import User from "@/models/User";
import Brand from "@/models/Brand";
import { getUserFromCookies } from "@/lib/helper";
import { computeBatchStatus } from "@/lib/batchHelper";
import { sortBatchesByTiming } from "@/lib/slotHelper";
import { syncBatchRefs } from "@/lib/referenceHelper";

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
      const bRegex = new RegExp(`^${brand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i");
      const brandDoc = (mongoose.Types.ObjectId.isValid(brand)
        ? await Brand.findById(brand).lean()
        : await Brand.findOne({ $or: [{ name: bRegex }, { code: bRegex }] }).lean()) as any;
      if (brandDoc) {
        query.$or = [{ brandId: brandDoc._id }, { brand: bRegex }];
      } else {
        query.brand = { $regex: bRegex };
      }
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

      if (!b.timing || !b.timing.trim()) {
        const defaultTiming = "10:00 AM - 12:00 PM";
        updates.timing = defaultTiming;
        batches[i].timing = defaultTiming;
        needsDbUpdate = true;
      } else if (/12:00\s*AM/i.test(b.timing)) {
        const correctedTiming = b.timing.replace(/12:00\s*AM/gi, "12:00 PM");
        updates.timing = correctedTiming;
        batches[i].timing = correctedTiming;
        needsDbUpdate = true;
      }

      if (!b.startDate) {
        const defaultStart = b.createdAt ? new Date(b.createdAt) : new Date();
        updates.startDate = defaultStart;
        batches[i].startDate = defaultStart;
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

    // Attach enrolled student counts strictly by unique batchId
    try {
      const Admission = (await import("@/models/Admission")).default;
      const Enquiry = (await import("@/models/Enquiry")).default;
      const Attendance = (await import("@/models/Attendance")).default;

      for (let i = 0; i < batches.length; i++) {
        const b = batches[i] as any;
        const bIdStr = b._id ? b._id.toString() : "";
        const bCustomId = b.batchId || "";

        const batchIdOrConditions: any[] = [];
        if (b._id) batchIdOrConditions.push({ batchId: b._id });
        if (bIdStr) batchIdOrConditions.push({ batchId: bIdStr });
        if (bCustomId && bCustomId !== bIdStr) batchIdOrConditions.push({ batchId: bCustomId });

        let admittedStudents: any[] = [];
        if (batchIdOrConditions.length > 0) {
          const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const activeStatusFilter = { $nin: ["Cancelled", "Refunded", "Dropped", "Transferred"] };

          // 1. Direct query scoped to batch and active admissions
          const baseMatch: any = {
            $or: batchIdOrConditions,
            status: activeStatusFilter,
          };
          if (b.brand) {
            baseMatch.brand = { $regex: new RegExp(`^${escapeRegExp(b.brand.trim())}$`, "i") };
          }

          admittedStudents = await Admission.find(baseMatch)
            .select("fullName studentFullName admissionId mobileNumber")
            .lean();

          // If no direct admissions matched with brand filter, try without brand filter (in case admission brand is unassigned)
          if (admittedStudents.length === 0) {
            admittedStudents = await Admission.find({
              $or: batchIdOrConditions,
              status: activeStatusFilter,
            })
              .select("fullName studentFullName admissionId mobileNumber")
              .lean();
          }

          // 2. If still no direct admissions, check if an attendance session was already recorded for this batch
          if (admittedStudents.length === 0) {
            const attConditions: any[] = [];
            if (b._id) attConditions.push({ batchId: b._id });
            if (bIdStr) attConditions.push({ batchId: bIdStr });
            if (bCustomId && bCustomId !== bIdStr) attConditions.push({ batchId: bCustomId });
            const latestAtt = await Attendance.findOne({ $or: attConditions }).sort({ date: -1 }).lean();
            if (latestAtt && Array.isArray(latestAtt.records) && latestAtt.records.length > 0) {
              admittedStudents = latestAtt.records.map((r: any) => ({
                fullName: r.studentName || "Student",
                studentFullName: r.studentName || "Student",
                admissionId: r.admissionId || "",
                mobileNumber: r.mobileNumber || "",
              }));
            }
          }

          // 3. Only if still 0 and batchName exists, check legacy admissions but strictly scoped to the same brand & course
          if (admittedStudents.length === 0 && b.batchName) {
            const nameCount = await Batch.countDocuments({
              batchName: { $regex: new RegExp(`^${escapeRegExp(b.batchName.trim())}$`, "i") }
            });

            if (nameCount === 1) {
              const legacyQuery: any = {
                batch: { $regex: new RegExp(`^${escapeRegExp(b.batchName.trim())}$`, "i") },
                $or: [{ batchId: { $exists: false } }, { batchId: "" }, { batchId: null }],
                status: activeStatusFilter,
              };
              if (b.brand) {
                legacyQuery.brand = { $regex: new RegExp(`^${escapeRegExp(b.brand.trim())}$`, "i") };
              }
              if (b.course) {
                legacyQuery.course = { $regex: new RegExp(`^${escapeRegExp(b.course.trim())}$`, "i") };
              }

              const legacyAdmissions = await Admission.find(legacyQuery)
                .select("fullName studentFullName admissionId mobileNumber")
                .lean();
              if (legacyAdmissions.length > 0) {
                admittedStudents = legacyAdmissions;
              }
            }
          }
        }

        const studentNames = admittedStudents.map((a: any) => a.fullName || a.studentFullName || a.admissionId);
        (batches[i] as any).students = studentNames;
        (batches[i] as any).enrolledCount = admittedStudents.length;
        (batches[i] as any).enrolledStudentsCount = admittedStudents.length;
      }
    } catch (e) {
      console.error("Error calculating batch student counts from admissions:", e);
    }

    batches = sortBatchesByTiming(batches);

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

    const batchPayload: any = {
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
    };
    await syncBatchRefs(batchPayload);

    const newBatch = await Batch.create(batchPayload);

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
