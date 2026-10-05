/**
 * Repairs Admission.downpaymentAmount values inflated by the old payments API.
 *
 * From 28 Jul 2026 until the collection-logic fix, every receipt recorded with the
 * "Down Payment" option (remarks contain "down payment") ADDED its amount to the admission's
 * downpaymentAmount, which is meant to be the AGREED down payment. A ₹10,000 down payment that
 * was paid became ₹20,000; deleting the receipt did not undo it.
 *
 * For each affected admission:
 *   original agreed down payment = current downpaymentAmount − sum of those down-payment receipts
 *   (soft-deleted receipts included, because deleting never reversed the increase)
 *
 * Only clear cases are fixed automatically. An admission is left for manual review when:
 *   - the result would be negative (it cannot have been inflated by those receipts);
 *   - its EMI plan agrees with the CURRENT down payment (fee − registration − plan total), i.e.
 *     it looks correct already, e.g. staff fixed it by hand;
 *   - the corrected value disagrees with the EMI plan;
 *   - the audit log shows a staff edit of the down payment after the receipt. (Down payment edits
 *     were only audited from this fix onwards, so older hand corrections are caught by the EMI
 *     plan check where a plan exists; admissions without a plan rely on the dry-run review.)
 *
 * Safe to re-run: each fix stores a backup row and admissions with a backup are skipped.
 *
 *   node scripts/repair-inflated-downpayments.ts            # dry run, changes nothing
 *   node scripts/repair-inflated-downpayments.ts --apply    # writes the CLEAR fixes
 *   node scripts/repair-inflated-downpayments.ts --undo     # restores values from the backups
 */
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href, pathToFileURL(process.cwd() + "/"));
process.env.DISABLE_CRON = "true";

/** The inflating code shipped in commit 151f560 on 28 Jul 2026 (17:02 IST). */
export const INFLATION_STARTED_AT = new Date("2026-07-28T00:00:00+05:30");
export const BACKUP_COLLECTION = "repair_downpayment_backups";

export type RepairStatus = "FIX" | "REVIEW" | "ALREADY_REPAIRED";

export interface RepairRow {
  admissionId: string;
  admissionCode: string;
  studentName: string;
  currentDownpayment: number;
  downpaymentReceipts: number;
  receiptCount: number;
  proposedDownpayment: number;
  status: RepairStatus;
  reason: string;
  paymentIds: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function planDownpaymentRepair(): Promise<RepairRow[]> {
  const { default: Admission } = await import("@/models/Admission");
  const { default: Payment } = await import("@/models/Payment");
  const { default: AuditLog } = await import("@/models/AuditLog");

  // Every receipt the old code treated as a down payment, including soft-deleted ones
  const receipts: any[] = await Payment.find({
    remarks: { $regex: /down\s*payment/i },
    createdAt: { $gte: INFLATION_STARTED_AT },
  })
    .setOptions({ includeDeleted: true })
    .select("admissionId amountReceived createdAt isDeleted remarks")
    .lean();

  const byAdmission = new Map<string, any[]>();
  for (const r of receipts) {
    const key = String(r.admissionId);
    if (!byAdmission.has(key)) byAdmission.set(key, []);
    byAdmission.get(key)!.push(r);
  }
  if (byAdmission.size === 0) return [];

  const ids = [...byAdmission.keys()].map((id) => new mongoose.Types.ObjectId(id));
  const admissions: any[] = await Admission.find({ _id: { $in: ids } })
    .setOptions({ includeDeleted: true })
    .select("admissionId fullName downpaymentAmount registrationAmount finalFee courseFee customEmiPlan isDeleted")
    .lean();

  const backups: any[] = await mongoose.connection
    .collection(BACKUP_COLLECTION)
    .find({ admissionId: { $in: ids } })
    .toArray();
  const repaired = new Set(backups.filter((b) => !b.undoneAt).map((b) => String(b.admissionId)));
  // (old, new) value pairs written by this script (repair and undo), to ignore in the audit check
  const ownChanges = new Set(
    backups.flatMap((b) => [`${b.admissionId}:${b.oldValue}->${b.newValue}`, `${b.admissionId}:${b.newValue}->${b.oldValue}`])
  );

  const rows: RepairRow[] = [];
  for (const adm of admissions) {
    const key = String(adm._id);
    const list = byAdmission.get(key) || [];
    const inflation = round2(list.reduce((s, r) => s + (Number(r.amountReceived) || 0), 0));
    const current = round2(Number(adm.downpaymentAmount) || 0);
    const proposed = round2(current - inflation);
    const base: Omit<RepairRow, "status" | "reason"> = {
      admissionId: key,
      admissionCode: adm.admissionId || "",
      studentName: adm.fullName || "",
      currentDownpayment: current,
      downpaymentReceipts: inflation,
      receiptCount: list.length,
      proposedDownpayment: proposed,
      paymentIds: list.map((r) => String(r._id)),
    };

    if (repaired.has(key)) {
      rows.push({ ...base, status: "ALREADY_REPAIRED", reason: "A backup from an earlier run exists." });
      continue;
    }

    const firstReceiptAt = new Date(Math.min(...list.map((r) => new Date(r.createdAt).getTime())));
    const audits: any[] = await AuditLog.find({
      collection: "admissions",
      docId: { $in: [adm._id, key] },
      "changedFields.field": "downpaymentAmount",
      at: { $gte: firstReceiptAt },
    }).lean();
    const manualEdits = audits.filter((a) =>
      (a.changedFields || []).some(
        (c: any) => c.field === "downpaymentAmount" && !ownChanges.has(`${key}:${Number(c.oldValue)}->${Number(c.newValue)}`)
      )
    ).length;

    const reviews: string[] = [];
    if (manualEdits > 0) reviews.push("Down payment was edited by staff after the receipt; it may already be correct.");
    if (proposed < 0) reviews.push("Receipts exceed the stored down payment, so it was not inflated by them (or was already corrected).");

    const plan: any[] = Array.isArray(adm.customEmiPlan) ? adm.customEmiPlan : [];
    let planNote = "No EMI plan to cross-check.";
    if (plan.length > 0 && proposed >= 0) {
      const fee = Number(adm.finalFee) || Number(adm.courseFee) || 0;
      const registration = Number(adm.registrationAmount) || 0;
      const expectedPlan = round2(fee - registration - proposed);
      const planSum = round2(plan.reduce((s, e) => s + (Number(e?.amount) || 0), 0));
      if (inflation > 0 && Math.abs(planSum - round2(fee - registration - current)) <= 1) {
        reviews.push(
          `EMI plan total ₹${planSum} already matches the current down payment ₹${current}; it may have been corrected by hand.`
        );
      } else if (Math.abs(planSum - expectedPlan) <= 1) {
        planNote = "EMI plan total matches the corrected down payment.";
      } else if (planSum < expectedPlan) {
        // The old code also shrank instalment amounts on partial payments, so a smaller plan is expected
        planNote = "EMI plan total is lower (instalments reduced by earlier partial payments), consistent.";
      } else {
        reviews.push(
          `EMI plan total ₹${planSum} is more than fee − registration − corrected down payment (₹${expectedPlan}).`
        );
      }
    }

    if (adm.isDeleted) planNote += " (Admission is deleted.)";

    rows.push(
      reviews.length > 0
        ? { ...base, status: "REVIEW", reason: reviews.join(" ") }
        : { ...base, status: "FIX", reason: planNote }
    );
  }

  return rows.sort((a, b) => a.status.localeCompare(b.status) || a.studentName.localeCompare(b.studentName));
}

/** Writes the FIX rows. Returns how many admissions were changed. */
export async function applyDownpaymentRepair(rows: RepairRow[]): Promise<number> {
  const { default: Admission } = await import("@/models/Admission");
  const { logAuditEntry } = await import("@/lib/auditLogger");
  const backups = mongoose.connection.collection(BACKUP_COLLECTION);

  let changed = 0;
  for (const row of rows) {
    if (row.status !== "FIX") continue;
    const _id = new mongoose.Types.ObjectId(row.admissionId);

    // Only write if the value is still what we planned against (guards against concurrent edits)
    const res = await Admission.collection.updateOne(
      { _id, downpaymentAmount: row.currentDownpayment },
      {
        $set: {
          downpaymentAmount: row.proposedDownpayment,
          downpaymentAmountPaise: Math.round(row.proposedDownpayment * 100),
        },
      }
    );
    if (res.modifiedCount !== 1) {
      console.warn(`   ! Skipped ${row.studentName} (${row.admissionCode}): value changed since the dry run.`);
      continue;
    }

    await backups.insertOne({
      admissionId: _id,
      admissionCode: row.admissionCode,
      oldValue: row.currentDownpayment,
      newValue: row.proposedDownpayment,
      paymentIds: row.paymentIds,
      reason: "Down payment inflated by down-payment receipts (old payments API)",
      repairedAt: new Date(),
    });
    await logAuditEntry({
      collectionName: "admissions",
      docId: _id,
      action: "UPDATE",
      changedFields: [{ field: "downpaymentAmount", oldValue: row.currentDownpayment, newValue: row.proposedDownpayment }],
    });
    changed++;
  }
  return changed;
}

/** Restores every value changed by --apply (marks the backups as undone). */
export async function undoDownpaymentRepair(): Promise<number> {
  const { default: Admission } = await import("@/models/Admission");
  const { logAuditEntry } = await import("@/lib/auditLogger");
  const backups = mongoose.connection.collection(BACKUP_COLLECTION);
  const list = await backups.find({ undoneAt: { $exists: false } }).toArray();
  let restored = 0;
  for (const b of list as any[]) {
    await Admission.collection.updateOne(
      { _id: b.admissionId },
      { $set: { downpaymentAmount: b.oldValue, downpaymentAmountPaise: Math.round(b.oldValue * 100) } }
    );
    await logAuditEntry({
      collectionName: "admissions",
      docId: b.admissionId,
      action: "UPDATE",
      changedFields: [{ field: "downpaymentAmount", oldValue: b.newValue, newValue: b.oldValue }],
    });
    await backups.updateOne({ _id: b._id }, { $set: { undoneAt: new Date() } });
    restored++;
  }
  return restored;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function resolveMongoUri(uri: string): Promise<string> {
  if (!uri || !uri.startsWith("mongodb+srv://")) return uri;
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch {}
  const match = uri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)\?(.*)$/);
  if (!match) return uri;
  const [, user, pass, host, dbName, queryParams] = match;
  try {
    const records = await new Promise<dns.SrvRecord[]>((resolve, reject) =>
      dns.resolveSrv(`_mongodb._tcp.${host}`, (err, addrs) => (err ? reject(err) : resolve(addrs)))
    );
    if (records.length > 0) {
      const hosts = records.map((r) => `${r.name}:${r.port}`).sort().join(",");
      return `mongodb://${user}:${encodeURIComponent(pass)}@${hosts}/${dbName}?ssl=true&authSource=admin&${queryParams}`;
    }
  } catch (err: any) {
    console.warn("SRV resolution fallback:", err.message);
  }
  return uri;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

async function main() {
  const apply = process.argv.includes("--apply");
  const undo = process.argv.includes("--undo");

  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") process.loadEnvFile(envPath);
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set (.env).");

  await mongoose.connect(await resolveMongoUri(process.env.MONGODB_URI));
  console.log(`Database: ${mongoose.connection.name}`);

  try {
    if (undo) {
      const n = await undoDownpaymentRepair();
      console.log(`Restored ${n} admission(s) to their pre-repair down payment.`);
      return;
    }

    const rows = await planDownpaymentRepair();
    console.log(`Mode: ${apply ? "APPLY (writing to database)" : "DRY RUN (no changes)"}\n`);

    if (rows.length === 0) {
      console.log("No admissions have down-payment receipts from the affected period. Nothing to repair.");
      return;
    }

    for (const r of rows) {
      console.log(
        `[${r.status}] ${r.studentName} (${r.admissionCode || r.admissionId})\n` +
          `    stored down payment ${inr(r.currentDownpayment)} − ${r.receiptCount} down-payment receipt(s) ${inr(r.downpaymentReceipts)}` +
          ` = ${inr(r.proposedDownpayment)}\n    ${r.reason}`
      );
    }

    const fix = rows.filter((r) => r.status === "FIX");
    const review = rows.filter((r) => r.status === "REVIEW");
    const done = rows.filter((r) => r.status === "ALREADY_REPAIRED");
    console.log(`\nSummary: ${fix.length} to fix, ${review.length} need manual review, ${done.length} already repaired.`);

    if (apply) {
      const n = await applyDownpaymentRepair(rows);
      console.log(`Applied: ${n} admission(s) updated. Backups in "${BACKUP_COLLECTION}"; undo with --undo.`);
    } else if (fix.length > 0) {
      console.log("Run again with --apply to write the fixes.");
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && process.argv[1].endsWith("repair-inflated-downpayments.ts")) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Repair failed:", err);
      process.exit(1);
    });
}
