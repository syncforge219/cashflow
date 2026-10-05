import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";

register(
  pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href,
  pathToFileURL(process.cwd() + "/")
);
process.env.DISABLE_CRON = "true";
process.env.FIELD_ENCRYPTION_KEY = "d".repeat(64);

describe("repair-inflated-downpayments", () => {
  let mongod: MongoMemoryServer;
  let repair: typeof import("../scripts/repair-inflated-downpayments");
  let Admission: any;
  let AuditLog: any;
  const ids: Record<string, mongoose.Types.ObjectId> = {};

  const AFTER = new Date("2026-08-10T10:00:00+05:30");
  const BEFORE = new Date("2026-07-20T10:00:00+05:30");

  async function admission(name: string, fields: any) {
    const _id = new mongoose.Types.ObjectId();
    ids[name] = _id;
    await mongoose.connection.collection("admissions").insertOne({
      _id,
      admissionId: `ADM-${name}`,
      fullName: name,
      finalFee: 40000,
      registrationAmount: 5000,
      isDeleted: false,
      ...fields,
    });
  }
  async function receipt(name: string, amount: number, remarks: string, createdAt = AFTER, extra: any = {}) {
    await mongoose.connection.collection("payments").insertOne({
      admissionId: ids[name],
      studentName: name,
      amountReceived: amount,
      paymentMode: "Cash",
      remarks,
      createdAt,
      updatedAt: createdAt,
      isDeleted: false,
      ...extra,
    });
  }

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri("repair_test"));
    repair = await import("../scripts/repair-inflated-downpayments");
    Admission = (await import("../src/models/Admission")).default;
    AuditLog = (await import("../src/models/AuditLog")).default;

    // Agreed 10,000, paid 10,000 as a down payment -> stored 20,000
    await admission("Inflated", { downpaymentAmount: 20000 });
    await receipt("Inflated", 10000, "Down Payment Collection");

    // Paid in two parts, with an EMI plan that agrees with 10,000 (40,000 - 5,000 - 10,000 = 25,000)
    await admission("TwoParts", {
      downpaymentAmount: 20000,
      customEmiPlan: [{ amount: 12500 }, { amount: 12500 }],
    });
    await receipt("TwoParts", 4000, "UPI ref 123 (Down Payment)");
    await receipt("TwoParts", 6000, "Down Payment Collection");

    // Receipt later deleted: the increase was never undone, so it still counts
    await admission("Deleted", { downpaymentAmount: 16000 });
    await receipt("Deleted", 8000, "Down Payment Collection", AFTER, { isDeleted: true, deletedAt: AFTER });

    // Staff already corrected it by hand -> review
    await admission("Edited", { downpaymentAmount: 10000 });
    await receipt("Edited", 10000, "Down Payment Collection");
    await AuditLog.create({
      collection: "admissions",
      docId: ids.Edited,
      action: "UPDATE",
      changedFields: [{ field: "downpaymentAmount", oldValue: 20000, newValue: 10000 }],
      at: new Date("2026-08-12T10:00:00+05:30"),
    });

    // Down payment smaller than the receipts -> review
    await admission("Negative", { downpaymentAmount: 3000 });
    await receipt("Negative", 5000, "Down Payment Collection");

    // EMI plan disagrees with the corrected value -> review
    await admission("PlanMismatch", { downpaymentAmount: 20000, customEmiPlan: [{ amount: 30000 }] });
    await receipt("PlanMismatch", 10000, "Down Payment Collection");

    // Plan agrees with the CURRENT value (40,000 - 5,000 - 20,000 = 15,000) -> looks hand-corrected, review
    await admission("PlanMatchesCurrent", { downpaymentAmount: 20000, customEmiPlan: [{ amount: 15000 }] });
    await receipt("PlanMatchesCurrent", 10000, "Down Payment Collection");

    // Before the bug shipped -> not touched
    await admission("OldReceipt", { downpaymentAmount: 10000 });
    await receipt("OldReceipt", 10000, "Down Payment Collection", BEFORE);

    // Ordinary receipts only -> not touched
    await admission("NoDp", { downpaymentAmount: 0 });
    await receipt("NoDp", 5000, "Initial registration payment upon admission");
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  const byName = (rows: any[]) => Object.fromEntries(rows.map((r) => [r.studentName, r]));

  test("dry run classifies each case without changing anything", async () => {
    const rows = byName(await repair.planDownpaymentRepair());

    assert.deepEqual(Object.keys(rows).sort(), ["Deleted", "Edited", "Inflated", "Negative", "PlanMatchesCurrent", "PlanMismatch", "TwoParts"]);
    assert.equal(rows.Inflated.status, "FIX");
    assert.equal(rows.Inflated.proposedDownpayment, 10000);
    assert.equal(rows.TwoParts.status, "FIX");
    assert.equal(rows.TwoParts.proposedDownpayment, 10000);
    assert.match(rows.TwoParts.reason, /matches/);
    assert.equal(rows.Deleted.status, "FIX");
    assert.equal(rows.Deleted.proposedDownpayment, 8000);
    assert.equal(rows.Edited.status, "REVIEW");
    assert.equal(rows.Negative.status, "REVIEW");
    assert.equal(rows.PlanMismatch.status, "REVIEW");
    assert.equal(rows.PlanMatchesCurrent.status, "REVIEW");

    const stored = await Admission.collection.findOne({ _id: ids.Inflated });
    assert.equal(stored.downpaymentAmount, 20000, "dry run wrote nothing");
  });

  test("apply fixes only the clear cases, with backup + audit entry, and is idempotent", async () => {
    const changed = await repair.applyDownpaymentRepair(await repair.planDownpaymentRepair());
    assert.equal(changed, 3);

    const get = async (n: string) => Admission.collection.findOne({ _id: ids[n] });
    assert.equal((await get("Inflated")).downpaymentAmount, 10000);
    assert.equal((await get("Inflated")).downpaymentAmountPaise, 1000000);
    assert.equal((await get("TwoParts")).downpaymentAmount, 10000);
    assert.equal((await get("Deleted")).downpaymentAmount, 8000);
    assert.equal((await get("Edited")).downpaymentAmount, 10000, "review case untouched");
    assert.equal((await get("PlanMismatch")).downpaymentAmount, 20000, "review case untouched");
    assert.equal((await get("OldReceipt")).downpaymentAmount, 10000, "pre-bug receipt untouched");

    assert.equal(await mongoose.connection.collection(repair.BACKUP_COLLECTION).countDocuments(), 3);
    assert.equal(
      await AuditLog.countDocuments({ collection: "admissions", docId: String(ids.Inflated), "changedFields.newValue": 10000 }),
      1
    );

    // Second run: nothing more to do
    const again = byName(await repair.planDownpaymentRepair());
    assert.equal(again.Inflated.status, "ALREADY_REPAIRED");
    assert.equal(await repair.applyDownpaymentRepair(Object.values(again)), 0);
    assert.equal((await get("Inflated")).downpaymentAmount, 10000);
  });

  test("undo restores the original values", async () => {
    assert.equal(await repair.undoDownpaymentRepair(), 3);
    const get = async (n: string) => Admission.collection.findOne({ _id: ids[n] });
    assert.equal((await get("Inflated")).downpaymentAmount, 20000);
    assert.equal((await get("Deleted")).downpaymentAmount, 16000);
    // After undo the cases are fixable again
    assert.equal(byName(await repair.planDownpaymentRepair()).Inflated.status, "FIX");
  });
});
