import mongoose, { type ClientSession } from "mongoose";
import Batch from "@/models/Batch";
import Counter from "@/models/Counter";
import { getNextSequence } from "@/lib/sequenceHelper";
import { computeBatchStatus } from "@/lib/batchHelper";
import { isBatchScheduledOnDay, parseBatchTimingRange } from "@/lib/slotHelper";
import { parseDateOnly, toDateKey } from "@/lib/dates";

/**
 * Rules for creating batches and assigning students to them. Used by the batch APIs and by every
 * admissions path that sets a student's batch, so they all behave the same way.
 */

export class BatchRuleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "BatchRuleError";
    this.status = status;
  }
}

export const DAY_CODES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Admissions that no longer occupy a seat. */
export const INACTIVE_ADMISSION_STATUSES = ["Cancelled", "Refunded", "Dropped", "Transferred"];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const normalizeRole = (role: unknown) => String(role || "").toLowerCase().replace(/[\s_-]+/g, "");

export function isTeacherRole(role: unknown) {
  const r = normalizeRole(role);
  return r === "teacher" || r === "faculty" || r === "instructor";
}

/** Who may delete a batch (others can cancel it instead). */
export function canDeleteBatch(role: unknown) {
  return ["superadmin", "admin", "director", "brandmanager", "manager", "centrehead", "centerhead"].includes(normalizeRole(role));
}

/** The specific brands a user is limited to, or null when they can see all brands. */
export function userBrandList(user: any): string[] | null {
  const scope = String(user?.brandScope || user?.brand || "").trim();
  if (!scope || /^(all|all brands|global|\*)$/i.test(scope)) return null;
  return scope.split(/[,/|]/).map((b) => b.trim()).filter(Boolean);
}

export function userCanUseBrand(user: any, brand: string | null | undefined) {
  const allowed = userBrandList(user);
  if (!allowed) return true;
  const b = String(brand || "").trim().toLowerCase();
  return allowed.some((a) => a.toLowerCase() === b);
}

/** "mon", "Monday", "MON" -> "Mon"; unknown values dropped; order Mon..Sun; no duplicates. */
export function normalizeDays(days: unknown): string[] {
  const list = Array.isArray(days) ? days : typeof days === "string" ? days.split(/[,\s]+/) : [];
  const set = new Set(
    list
      .map((d) => String(d || "").trim().slice(0, 3).toLowerCase())
      .map((d) => DAY_CODES.find((c) => c.toLowerCase() === d))
      .filter(Boolean) as string[]
  );
  return DAY_CODES.filter((d) => set.has(d));
}

/** Every form in which an admission may store a batch reference (ObjectId, its string, or the BATxxxxxx code). */
export function batchRefConditions(batch: { _id?: any; batchId?: string | null }) {
  const conds: any[] = [];
  if (batch._id) {
    conds.push({ batchId: batch._id }, { batchId: String(batch._id) });
  }
  if (batch.batchId) conds.push({ batchId: batch.batchId });
  return conds;
}

/** Finds a batch by its Mongo _id or its BATxxxxxx code. */
export async function findBatchByAnyId(raw: unknown, session?: ClientSession | null) {
  const id = String(raw ?? "").trim();
  if (!id || id === "null" || id === "undefined") return null;
  const or: any[] = [{ batchId: id }];
  if (mongoose.Types.ObjectId.isValid(id)) or.push({ _id: new mongoose.Types.ObjectId(id) });
  const q = Batch.findOne({ $or: or });
  if (session) q.session(session);
  return q.lean() as Promise<any>;
}

/** Students currently occupying a seat in the batch. */
export async function countEnrolled(batch: any, excludeAdmissionId?: any) {
  const Admission = (await import("@/models/Admission")).default;
  const query: any = { $or: batchRefConditions(batch), status: { $nin: INACTIVE_ADMISSION_STATUSES } };
  if (excludeAdmissionId) query._id = { $ne: excludeAdmissionId };
  return Admission.countDocuments(query);
}

/**
 * Checks that a student may be placed in this batch: the batch exists, is not cancelled or
 * completed, belongs to the student's brand, and still has a free seat.
 * Historical imports skip the status and capacity checks (the class may be long finished).
 */
export async function resolveBatchForAssignment(
  rawBatchId: unknown,
  opts: { admissionId?: any; studentBrand?: string | null; historical?: boolean } = {}
) {
  const batch = await findBatchByAnyId(rawBatchId);
  if (!batch) throw new BatchRuleError("That batch no longer exists. Pick another batch.");

  if (!opts.historical) {
    const status = computeBatchStatus(batch.startDate, batch.endDate, batch.status, new Date(), batch.statusLocked);
    if (status === "Cancelled" || status === "Completed") {
      throw new BatchRuleError(`Batch "${batch.batchName}" is ${status.toLowerCase()}; students can't be added to it.`);
    }
  }

  const studentBrand = String(opts.studentBrand || "").trim();
  if (studentBrand && batch.brand && studentBrand.toLowerCase() !== String(batch.brand).trim().toLowerCase()) {
    throw new BatchRuleError(`This student belongs to ${studentBrand}, but batch "${batch.batchName}" is a ${batch.brand} batch.`);
  }

  if (!opts.historical) {
    const capacity = Number(batch.maxCapacity) || 0;
    if (capacity > 0) {
      const enrolled = await countEnrolled(batch, opts.admissionId);
      if (enrolled >= capacity) {
        throw new BatchRuleError(`Batch "${batch.batchName}" is full (${enrolled}/${capacity} seats). Increase its capacity or pick another batch.`, 409);
      }
    }
  }
  return batch;
}

/**
 * Another active batch of the same teacher that runs on a shared day, at an overlapping time,
 * during overlapping dates. Returns that batch, or null when the teacher is free.
 */
export async function findTeacherClash(input: {
  teacherId: any;
  timing: string;
  days: string[];
  startDate: Date;
  endDate?: Date | null;
  excludeBatchId?: any;
}) {
  const range = parseBatchTimingRange(input.timing);
  if (!range || !input.teacherId) return null;

  const query: any = { teacherId: input.teacherId, status: { $nin: ["Cancelled", "Completed"] } };
  if (input.excludeBatchId) query._id = { $ne: input.excludeBatchId };
  const others: any[] = await Batch.find(query).select("batchName batchId timing days startDate endDate status statusLocked").lean();

  const startKey = toDateKey(input.startDate);
  const endKey = input.endDate ? toDateKey(input.endDate) : "9999-12-31";

  for (const other of others) {
    if (computeBatchStatus(other.startDate, other.endDate, other.status, new Date(), other.statusLocked) === "Completed") continue;
    const oStart = toDateKey(other.startDate) || "0000-01-01";
    const oEnd = other.endDate ? toDateKey(other.endDate) : "9999-12-31";
    if (oStart > endKey || startKey > oEnd) continue; // dates don't overlap

    const sharesDay =
      input.days.length === 0 || !Array.isArray(other.days) || other.days.length === 0
        ? true
        : input.days.some((d) => isBatchScheduledOnDay(other, d));
    if (!sharesDay) continue;

    const o = parseBatchTimingRange(other.timing);
    if (!o) continue;
    if (Math.max(range.startMin, o.startMin) < Math.min(range.endMin, o.endMin)) return other;
  }
  return null;
}

/**
 * Next BATxxxxxx code. Older code generated codes as "highest existing + 1" without the counter,
 * so the counter can lag behind; if the generated code is taken, the counter is moved past the
 * highest existing code and we try again.
 */
export async function nextBatchCode(): Promise<string> {
  const highestExisting = async () => {
    const last: any = await Batch.findOne({ batchId: /^BAT\d+$/ }).sort({ batchId: -1 }).select("batchId").lean();
    const m = last?.batchId?.match(/^BAT(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = await getNextSequence("batchId", "BAT", 6, highestExisting);
    if (!(await Batch.exists({ batchId: code }))) return code;
    const max = await highestExisting();
    await Counter.updateOne({ name: "batchId" }, { $max: { seq: max } });
  }
  throw new BatchRuleError("Could not generate a batch code. Please try again.", 500);
}

/** Batch name, unique per brand (case-insensitive), because students and reports refer to batches by name. */
export async function assertUniqueBatchName(name: string, brand: string, excludeId?: any) {
  const query: any = {
    batchName: new RegExp(`^${escapeRegex(name.trim())}$`, "i"),
    brand: new RegExp(`^${escapeRegex(brand.trim())}$`, "i"),
  };
  if (excludeId) query._id = { $ne: excludeId };
  const dupe: any = await Batch.findOne(query).select("batchId").lean();
  if (dupe) throw new BatchRuleError(`A ${brand} batch named "${name.trim()}" already exists (${dupe.batchId}). Use a different name.`, 409);
}

export interface CleanBatchFields {
  batchName?: string;
  course?: string;
  courses?: string[];
  courseCode?: string;
  teacherId?: any;
  teacherName?: string;
  brand?: string;
  startDate?: Date;
  endDate?: Date | null;
  timing?: string;
  days?: string[];
  maxCapacity?: number;
  notes?: string;
}

/**
 * Validates and normalises batch fields. With `partial`, only the fields present in the body are
 * checked (edit); otherwise all required fields must be there (create).
 */
export async function cleanBatchFields(body: any, partial: boolean): Promise<CleanBatchFields> {
  const out: CleanBatchFields = {};
  const has = (k: string) => body[k] !== undefined;
  const User = (await import("@/models/User")).default;

  if (!partial || has("batchName")) {
    const name = String(body.batchName || "").trim();
    if (!name) throw new BatchRuleError("Batch name is required.");
    if (name.length > 120) throw new BatchRuleError("Batch name is too long.");
    out.batchName = name;
  }

  if (!partial || has("courses") || has("course")) {
    const list: string[] =
      Array.isArray(body.courses) && body.courses.length > 0
        ? body.courses
        : String(body.course || "").split(",");
    const courses = Array.from(new Set(list.map((c) => String(c).trim()).filter(Boolean)));
    if (courses.length === 0) throw new BatchRuleError("Select at least one course.");
    out.courses = courses;
    out.course = courses.join(", ");
  }
  if (has("courseCode")) out.courseCode = String(body.courseCode || "").trim() || undefined;

  if (!partial || has("teacherId")) {
    const tId = String(body.teacherId || "").trim();
    if (!mongoose.Types.ObjectId.isValid(tId)) throw new BatchRuleError("Select the faculty / teacher for this batch.");
    const teacher: any = await User.findById(tId).select("name role").lean();
    if (!teacher) throw new BatchRuleError("The selected teacher no longer exists.");
    out.teacherId = teacher._id;
    out.teacherName = teacher.name || "Faculty";
  }

  if (!partial || has("brand")) {
    const brand = String(body.brand || "").trim();
    if (!brand || /^(all|all brands)$/i.test(brand)) throw new BatchRuleError("Choose which brand this batch belongs to.");
    out.brand = brand;
  }

  if (!partial || has("startDate")) {
    const d = parseDateOnly(body.startDate);
    if (!d) throw new BatchRuleError("Start date is required.");
    out.startDate = d;
  }
  if (has("endDate")) {
    if (body.endDate === null || body.endDate === "") out.endDate = null;
    else {
      const d = parseDateOnly(body.endDate);
      if (!d) throw new BatchRuleError("End date is not valid.");
      out.endDate = d;
    }
  }

  if (!partial || has("timing")) {
    const timing = String(body.timing || "").trim();
    if (!timing) throw new BatchRuleError("Class timing is required.");
    const range = parseBatchTimingRange(timing);
    if (!range) throw new BatchRuleError('Write the timing as a range, e.g. "10:00 AM - 12:00 PM".');
    if (range.endMin <= range.startMin) throw new BatchRuleError("Class timing must end after it starts.");
    out.timing = timing;
  }

  if (!partial || has("days")) {
    const days = normalizeDays(body.days);
    if (days.length === 0) throw new BatchRuleError("Select at least one class day.");
    out.days = days;
  }

  if (!partial || has("maxCapacity")) {
    const cap = body.maxCapacity === undefined || body.maxCapacity === "" ? 30 : Number(body.maxCapacity);
    if (!Number.isInteger(cap) || cap < 1 || cap > 500) throw new BatchRuleError("Max capacity must be a whole number from 1 to 500.");
    out.maxCapacity = cap;
  }

  if (has("notes")) out.notes = String(body.notes || "").trim();
  return out;
}
