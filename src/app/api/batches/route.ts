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
import {
  BatchRuleError,
  INACTIVE_ADMISSION_STATUSES,
  assertUniqueBatchName,
  batchRefConditions,
  cleanBatchFields,
  findTeacherClash,
  isTeacherRole,
  nextBatchCode,
  userBrandList,
  userCanUseBrand,
} from "@/lib/batchRules";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function ruleErrorResponse(error: any, fallback: string) {
  if (error instanceof BatchRuleError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  if (error?.code === 11000) {
    return NextResponse.json({ success: false, error: "A batch with this code already exists. Please try again." }, { status: 409 });
  }
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
  console.error(`[Batches API] ${fallback}:`, error);
  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const { searchParams } = new URL(request.url);
    const brandParam = searchParams.get("brand");
    let teacherId = searchParams.get("teacherId");
    const status = searchParams.get("status");
    const course = searchParams.get("course");
    const all = searchParams.get("all");
    const batchIdParam = searchParams.get("batchId");

    // Every filter is its own AND clause, so one filter can never replace another
    // (the teacher filter used to overwrite the brand restriction).
    const and: any[] = [];

    // Brand: a brand-restricted user only ever sees their own brand(s)
    const allowedBrands = userBrandList(user);
    let brandNames: string[] = [];
    if (allowedBrands) {
      const wanted = brandParam && !/^(all|all brands)$/i.test(brandParam) ? brandParam.trim() : "";
      brandNames = wanted && allowedBrands.some((b) => b.toLowerCase() === wanted.toLowerCase()) ? [wanted] : allowedBrands;
    } else if (brandParam && !/^(all|all brands)$/i.test(brandParam)) {
      brandNames = [brandParam.trim()];
    }
    if (brandNames.length > 0) {
      const regexes = brandNames.map((b) => new RegExp(`^${escapeRegex(b)}$`, "i"));
      const idCandidates = brandNames.filter((b) => mongoose.Types.ObjectId.isValid(b));
      const brandDocs: any[] = await Brand.find({
        $or: [{ name: { $in: regexes } }, { code: { $in: regexes } }, ...(idCandidates.length ? [{ _id: { $in: idCandidates } }] : [])],
      })
        .select("_id name")
        .lean();
      const nameRegexes = [...regexes, ...brandDocs.map((b) => new RegExp(`^${escapeRegex(String(b.name))}$`, "i"))];
      and.push({ $or: [{ brandId: { $in: brandDocs.map((b) => b._id) } }, { brand: { $in: nameRegexes } }] });
    }

    // Teachers see their own batches unless ?all=true
    if (!teacherId && user && isTeacherRole(user.role) && all !== "true") {
      teacherId = user._id ? user._id.toString() : (user as any)?.id || "";
    }
    if (teacherId) {
      let teacherName = "";
      if (mongoose.Types.ObjectId.isValid(teacherId)) {
        const teacherUser: any = await User.findById(teacherId).select("name").lean();
        teacherName = teacherUser?.name || "";
      }
      const teacherOr: any[] = [];
      if (mongoose.Types.ObjectId.isValid(teacherId)) teacherOr.push({ teacherId: new mongoose.Types.ObjectId(teacherId) });
      if (teacherName) teacherOr.push({ teacherName: new RegExp(`^${escapeRegex(teacherName.trim())}$`, "i") });
      if (teacherOr.length === 0) {
        return NextResponse.json({ success: true, count: 0, data: [], batches: [] });
      }
      and.push({ $or: teacherOr });
    }

    if (course) {
      const cRegex = new RegExp(escapeRegex(course.trim()), "i");
      and.push({ $or: [{ course: cRegex }, { courses: cRegex }] });
    }

    if (batchIdParam) {
      const trimmed = batchIdParam.trim();
      const bQuery: any[] = [{ batchId: trimmed }];
      if (mongoose.Types.ObjectId.isValid(trimmed)) bQuery.push({ _id: new mongoose.Types.ObjectId(trimmed) });
      and.push({ $or: bQuery });
    }

    // Status is filtered after it is recalculated below: the stored status can be out of date
    // (a batch stored as "Upcoming" may be Active today).
    if (status === "Cancelled") and.push({ status: "Cancelled" });

    let batches: any[] = await Batch.find(and.length ? { $and: and } : {}).sort({ createdAt: -1 }).lean();

    // Keep stored data in step: missing codes, lifecycle status, timing typo, missing start date
    const updatePromises: Promise<any>[] = [];
    for (const b of batches) {
      const updates: any = {};

      if (!b.batchId) {
        // One at a time through the counter; the old "highest + 1" gave every un-coded batch the same code
        updates.batchId = await nextBatchCode();
        b.batchId = updates.batchId;
      }

      const calculatedStatus = computeBatchStatus(b.startDate, b.endDate, b.status, new Date(), b.statusLocked);
      if (calculatedStatus !== b.status) {
        updates.status = calculatedStatus;
        b.status = calculatedStatus;
      }

      if (!b.timing || !String(b.timing).trim()) {
        updates.timing = "10:00 AM - 12:00 PM";
        b.timing = updates.timing;
      } else if (/12:00\s*AM/i.test(b.timing)) {
        // Classes never run at midnight: "12:00 AM" is a typo for noon
        updates.timing = b.timing.replace(/12:00\s*AM/gi, "12:00 PM");
        b.timing = updates.timing;
      }

      if (!b.startDate) {
        updates.startDate = b.createdAt ? new Date(b.createdAt) : new Date();
        b.startDate = updates.startDate;
      }

      if (Object.keys(updates).length > 0) {
        updatePromises.push(Batch.updateOne({ _id: b._id }, { $set: updates }));
      }
    }
    if (updatePromises.length > 0) await Promise.all(updatePromises);

    if (status && status !== "All Status") {
      batches = batches.filter((b) => b.status === status);
    }

    // Enrolled students. One query for all batches; older batches without assignments fall back
    // to their latest attendance sheet, then to name-matched legacy admissions (as before).
    try {
      const Admission = (await import("@/models/Admission")).default;
      const Attendance = (await import("@/models/Attendance")).default;

      const allConds = batches.flatMap((b) => batchRefConditions(b));
      const admitted: any[] = allConds.length
        ? await Admission.find({ $or: allConds, status: { $nin: INACTIVE_ADMISSION_STATUSES } })
            .select("fullName studentFullName admissionId mobileNumber batchId")
            .lean()
        : [];
      const byRef = new Map<string, any[]>();
      for (const a of admitted) {
        const key = String(a.batchId);
        if (!byRef.has(key)) byRef.set(key, []);
        byRef.get(key)!.push(a);
      }

      for (const b of batches) {
        const seen = new Set<string>();
        let students: any[] = [];
        for (const key of [String(b._id), b.batchId].filter(Boolean)) {
          for (const a of byRef.get(key) || []) {
            if (!seen.has(String(a._id))) {
              seen.add(String(a._id));
              students.push(a);
            }
          }
        }
        let fromAttendance = false;

        if (students.length === 0) {
          // Raw collection query: attendance stores the batch as an ObjectId, and the model would throw
          // when also matching the BATxxxxxx code form
          const latestAtt: any = await Attendance.collection.findOne({ $or: batchRefConditions(b) }, { sort: { date: -1 } });
          if (latestAtt && Array.isArray(latestAtt.records) && latestAtt.records.length > 0) {
            fromAttendance = true;
            students = latestAtt.records.map((r: any) => ({
              fullName: r.studentName || "Student",
              admissionId: r.admissionId || "",
              mobileNumber: r.mobileNumber || "",
            }));
          }
        }

        if (students.length === 0 && b.batchName) {
          const nameCount = await Batch.countDocuments({ batchName: new RegExp(`^${escapeRegex(b.batchName.trim())}$`, "i") });
          if (nameCount === 1) {
            const legacyQuery: any = {
              batch: new RegExp(`^${escapeRegex(b.batchName.trim())}$`, "i"),
              $or: [{ batchId: { $exists: false } }, { batchId: "" }, { batchId: null }],
              status: { $nin: INACTIVE_ADMISSION_STATUSES },
            };
            if (b.brand) legacyQuery.brand = new RegExp(`^${escapeRegex(b.brand.trim())}$`, "i");
            if (b.course) legacyQuery.course = new RegExp(`^${escapeRegex(b.course.trim())}$`, "i");
            students = await Admission.find(legacyQuery).select("fullName studentFullName admissionId mobileNumber").lean();
          }
        }

        b.students = students.map((a: any) => a.fullName || a.studentFullName || a.admissionId);
        b.enrolledCount = students.length;
        b.enrolledStudentsCount = students.length;
        b.enrolledFromAttendance = fromAttendance;
      }
    } catch (e) {
      console.error("Error calculating batch student counts from admissions:", e);
    }

    batches = sortBatchesByTiming(batches);
    return NextResponse.json({ success: true, count: batches.length, data: batches, batches });
  } catch (error: any) {
    return ruleErrorResponse(error, "Failed to fetch batches");
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    if (!user) return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
    const body = await request.json();

    const fields = await cleanBatchFields(body, false);
    if (!userCanUseBrand(user, fields.brand)) {
      return NextResponse.json({ success: false, error: `You can only create batches for ${userBrandList(user)?.join(", ")}.` }, { status: 403 });
    }
    if (fields.endDate && fields.startDate && fields.endDate < fields.startDate) {
      throw new BatchRuleError("End date is before the start date.");
    }
    await assertUniqueBatchName(fields.batchName!, fields.brand!);

    const clash = await findTeacherClash({
      teacherId: fields.teacherId,
      timing: fields.timing!,
      days: fields.days!,
      startDate: fields.startDate!,
      endDate: fields.endDate,
    });
    if (clash) {
      throw new BatchRuleError(
        `${fields.teacherName} already teaches "${clash.batchName}" (${clash.batchId}) at ${clash.timing} on ${(clash.days || []).join(", ") || "the same days"}. Pick another time or teacher.`,
        409
      );
    }

    // A custom code is accepted only if it is free; otherwise the next BATxxxxxx code is used
    let batchCode = String(body.batchId || "").trim();
    if (batchCode) {
      if (!/^[A-Za-z0-9-]{3,20}$/.test(batchCode)) throw new BatchRuleError("Batch code may only use letters, digits and '-' (3–20 characters).");
      if (await Batch.exists({ batchId: batchCode })) throw new BatchRuleError(`Batch code ${batchCode} is already used.`, 409);
    } else {
      batchCode = await nextBatchCode();
    }

    const payload: any = {
      ...fields,
      batchId: batchCode,
      endDate: fields.endDate || undefined,
      status: computeBatchStatus(fields.startDate, fields.endDate),
      statusLocked: false,
      // Who created it comes from the session, not from the request body
      createdBy: user.name || user.email || "User",
      creatorRole: String(user.role || ""),
    };
    await syncBatchRefs(payload);
    const newBatch = await Batch.create(payload);

    return NextResponse.json({ success: true, message: "Faculty batch created successfully", data: newBatch }, { status: 201 });
  } catch (error: any) {
    return ruleErrorResponse(error, "Failed to create batch");
  }
}
