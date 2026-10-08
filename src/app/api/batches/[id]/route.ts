import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Batch from "@/models/Batch";
import { getUserFromCookies } from "@/lib/helper";
import { computeBatchStatus } from "@/lib/batchHelper";
import { syncBatchRefs } from "@/lib/referenceHelper";
import {
  BatchRuleError,
  assertUniqueBatchName,
  batchRefConditions,
  canDeleteBatch,
  cleanBatchFields,
  countEnrolled,
  findBatchByAnyId,
  findTeacherClash,
  userBrandList,
  userCanUseBrand,
} from "@/lib/batchRules";

const STATUSES = ["Upcoming", "Active", "Completed", "Cancelled"];

function ruleErrorResponse(error: any, fallback: string) {
  if (error instanceof BatchRuleError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
  console.error(`[Batch API] ${fallback}:`, error);
  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}

const notFound = () => NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const { id } = await params;
    const batch: any = await findBatchByAnyId(id);
    if (!batch || !userCanUseBrand(user, batch.brand)) return notFound();

    const calculatedStatus = computeBatchStatus(batch.startDate, batch.endDate, batch.status, new Date(), batch.statusLocked);
    if (calculatedStatus !== batch.status) {
      await Batch.updateOne({ _id: batch._id }, { $set: { status: calculatedStatus } });
      batch.status = calculatedStatus;
    }
    return NextResponse.json({ success: true, data: batch });
  } catch (error: any) {
    return ruleErrorResponse(error, "Failed to fetch batch");
  }
}

/**
 * Edits a batch. Only known fields are accepted (the old handler wrote the raw request body,
 * so any field, including the batch code or counts, could be overwritten).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    if (!user) return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
    const { id } = await params;
    const body = await request.json();

    const oldBatch: any = await findBatchByAnyId(id);
    if (!oldBatch || !userCanUseBrand(user, oldBatch.brand)) return notFound();

    const fields = await cleanBatchFields(body, true);
    if (fields.brand && !userCanUseBrand(user, fields.brand)) {
      return NextResponse.json({ success: false, error: `You can only use ${userBrandList(user)?.join(", ")}.` }, { status: 403 });
    }

    const merged = {
      batchName: fields.batchName ?? oldBatch.batchName,
      brand: fields.brand ?? oldBatch.brand,
      teacherId: fields.teacherId ?? oldBatch.teacherId,
      teacherName: fields.teacherName ?? oldBatch.teacherName,
      timing: fields.timing ?? oldBatch.timing,
      days: fields.days ?? oldBatch.days ?? [],
      startDate: fields.startDate ?? oldBatch.startDate,
      endDate: fields.endDate !== undefined ? fields.endDate : oldBatch.endDate,
      maxCapacity: fields.maxCapacity ?? oldBatch.maxCapacity,
    };
    if (merged.endDate && merged.startDate && new Date(merged.endDate) < new Date(merged.startDate)) {
      throw new BatchRuleError("End date is before the start date.");
    }
    if (
      (fields.batchName && fields.batchName.toLowerCase() !== String(oldBatch.batchName).toLowerCase()) ||
      (fields.brand && fields.brand.toLowerCase() !== String(oldBatch.brand).toLowerCase())
    ) {
      await assertUniqueBatchName(merged.batchName, merged.brand, oldBatch._id);
    }

    // Capacity can't drop below the students already in the batch
    if (fields.maxCapacity !== undefined) {
      const enrolled = await countEnrolled(oldBatch);
      if (fields.maxCapacity < enrolled) {
        throw new BatchRuleError(`${enrolled} students are already in this batch; capacity can't be lower than that.`);
      }
    }

    // Status: Completed / Cancelled chosen by hand stay put; anything else follows the dates
    const requested = body.status !== undefined ? String(body.status) : undefined;
    if (requested !== undefined && !STATUSES.includes(requested)) throw new BatchRuleError("Unknown status");
    let status: string;
    let statusLocked: boolean;
    if (requested === "Cancelled") {
      status = requested;
      statusLocked = true;
    } else if (requested === "Completed") {
      status = requested;
      // Locked only when it is an early finish; if the end date has already passed, the dates say
      // Completed anyway and extending them later should reopen the batch
      statusLocked = computeBatchStatus(merged.startDate, merged.endDate) !== "Completed";
    } else if (requested === "Upcoming" || requested === "Active") {
      status = computeBatchStatus(merged.startDate, merged.endDate);
      statusLocked = false;
    } else {
      statusLocked = Boolean(oldBatch.statusLocked);
      status = computeBatchStatus(merged.startDate, merged.endDate, oldBatch.status, new Date(), statusLocked);
    }

    // The teacher must be free at the new time (skip for batches that are closed)
    const scheduleChanged =
      fields.teacherId !== undefined || fields.timing !== undefined || fields.days !== undefined ||
      fields.startDate !== undefined || fields.endDate !== undefined || (oldBatch.status !== status && (status === "Upcoming" || status === "Active"));
    if (scheduleChanged && status !== "Cancelled" && status !== "Completed") {
      const clash = await findTeacherClash({
        teacherId: merged.teacherId,
        timing: merged.timing,
        days: merged.days,
        startDate: merged.startDate,
        endDate: merged.endDate,
        excludeBatchId: oldBatch._id,
      });
      if (clash) {
        throw new BatchRuleError(
          `${merged.teacherName} already teaches "${clash.batchName}" (${clash.batchId}) at ${clash.timing} on ${(clash.days || []).join(", ") || "the same days"}.`,
          409
        );
      }
    }

    const $set: any = { ...fields, status, statusLocked };
    const $unset: any = {};
    if (fields.endDate === null) {
      delete $set.endDate;
      $unset.endDate = 1; // lets an end date be removed (it used to be impossible)
    }
    await syncBatchRefs($set);

    const updatedBatch: any = await Batch.findByIdAndUpdate(
      oldBatch._id,
      { $set, ...(Object.keys($unset).length ? { $unset } : {}) },
      { returnDocument: "after", runValidators: true }
    ).lean();

    // Renamed: update the batch name stored on its students. Match every form the reference is
    // stored in (ObjectId, its string, or the code); the old update missed ObjectId references.
    if (fields.batchName && fields.batchName !== oldBatch.batchName) {
      const Admission = (await import("@/models/Admission")).default;
      await Admission.updateMany({ $or: batchRefConditions(oldBatch) }, { $set: { batch: fields.batchName } });
    }

    return NextResponse.json({ success: true, message: "Batch updated successfully", data: updatedBatch });
  } catch (error: any) {
    return ruleErrorResponse(error, "Failed to update batch");
  }
}

/**
 * Deletes an empty batch. A batch with students or attendance history is cancelled instead, so
 * student records and attendance never point at a batch that no longer exists.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    if (!user) return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
    if (!canDeleteBatch(user.role)) {
      return NextResponse.json({ success: false, error: "Only admins and managers can delete batches. You can cancel it instead." }, { status: 403 });
    }
    const { id } = await params;
    const batch: any = await findBatchByAnyId(id);
    if (!batch || !userCanUseBrand(user, batch.brand)) return notFound();

    const enrolled = await countEnrolled(batch);
    if (enrolled > 0) {
      throw new BatchRuleError(`${enrolled} student${enrolled === 1 ? " is" : "s are"} in this batch. Move them to another batch first, or set the batch to Cancelled.`, 409);
    }
    const Attendance = (await import("@/models/Attendance")).default;
    // Raw collection query: matches every stored form of the batch reference without type casting
    if (await Attendance.collection.findOne({ $or: batchRefConditions(batch) }, { projection: { _id: 1 } })) {
      throw new BatchRuleError("This batch has attendance history. Set it to Cancelled or Completed instead of deleting it.", 409);
    }

    await Batch.deleteOne({ _id: batch._id });
    return NextResponse.json({ success: true, message: "Batch deleted successfully" });
  } catch (error: any) {
    return ruleErrorResponse(error, "Failed to delete batch");
  }
}
