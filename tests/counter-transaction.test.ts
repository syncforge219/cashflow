import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom alias loader so @/... imports resolve correctly in Node native ESM
register(pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href, pathToFileURL(process.cwd() + "/"));

// Disable background crons during testing so timers don't keep process alive
process.env.DISABLE_CRON = "true";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}
process.env.DISABLE_CRON = "true";

async function resolveMongoUri(uri: string): Promise<string> {
  if (!uri || !uri.startsWith("mongodb+srv://")) return uri;

  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (e) {
    // Ignore DNS server override error
  }

  const match = uri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)\?(.*)$/);
  if (!match) return uri;

  const [, user, pass, host, dbName, queryParams] = match;
  const srvDomain = `_mongodb._tcp.${host}`;

  try {
    const records = await new Promise<dns.SrvRecord[]>((resolve, reject) => {
      dns.resolveSrv(srvDomain, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });

    if (records && records.length > 0) {
      const hostList = records
        .map((r) => `${r.name}:${r.port}`)
        .sort()
        .join(",");
      return `mongodb://${user}:${encodeURIComponent(pass)}@${hostList}/${dbName}?ssl=true&authSource=admin&${queryParams}`;
    }
  } catch (err: any) {
    console.warn("SRV Resolution fallback notice:", err.message);
  }

  return uri;
}

describe("Counter Transaction Abort & Rollback Test Suite", async () => {
  let Counter: any;
  let getNextSequence: any;
  let QuotationCounter: any;
  let generateQuotationNumber: any;
  let Admission: any;

  before(async () => {
    const rawUri = process.env.MONGODB_URI;
    if (!rawUri) {
      throw new Error("MONGODB_URI not found in environment variables.");
    }
    const connectionUri = await resolveMongoUri(rawUri);
    await mongoose.connect(connectionUri, {
      bufferCommands: true,
      serverSelectionTimeoutMS: 10000,
    });

    // Dynamically load models & helpers
    const counterModule = await import("../src/models/Counter");
    Counter = counterModule.default;

    const seqHelperModule = await import("../src/lib/sequenceHelper");
    getNextSequence = seqHelperModule.getNextSequence;

    const quotCounterModule = await import("../src/models/QuotationCounter");
    QuotationCounter = quotCounterModule.default;

    const quotHelperModule = await import("../src/lib/quotationHelper");
    generateQuotationNumber = quotHelperModule.generateQuotationNumber;

    const admModule = await import("../src/models/Admission");
    Admission = admModule.default;
  });

  after(async () => {
    await mongoose.disconnect();
  });

  test("getNextSequence with session rolls back Counter when transaction aborts", async () => {
    const testCounterName = `test_counter_abort_${Date.now()}`;
    const initialSeq = 500;

    // 1. Initialize counter at initialSeq
    await Counter.create({ name: testCounterName, seq: initialSeq });

    const beforeDoc = await Counter.findOne({ name: testCounterName });
    assert.strictEqual(beforeDoc?.seq, 500, "Counter must start at 500");

    // 2. Start session and transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 3. Increment counter inside transaction
      const generatedId = await getNextSequence(testCounterName, "TST", 6, undefined, session);
      assert.strictEqual(generatedId, "TST000501", "Should generate TST000501 inside session");

      // Verify inside transaction that counter is 501
      const inTxDoc = await Counter.findOne({ name: testCounterName }).session(session);
      assert.strictEqual(inTxDoc?.seq, 501, "Inside transaction, counter must be 501");

      // 4. Abort the transaction
      await session.abortTransaction();
    } finally {
      await session.endSession();
    }

    // 5. Query counter outside transaction and assert sequence was NOT consumed
    const afterAbortDoc = await Counter.findOne({ name: testCounterName });
    assert.strictEqual(
      afterAbortDoc?.seq,
      500,
      "Counter sequence must roll back to 500 after abort without consuming 501"
    );

    // Clean up test counter
    await Counter.deleteOne({ name: testCounterName });
  });

  test("generateQuotationNumber with session rolls back QuotationCounter when transaction aborts", async () => {
    const testCompanyId = `TEST_COMP_${Date.now()}`;
    const fy = "2026-27";
    const initialSeq = 20;

    // 1. Initialize QuotationCounter
    await QuotationCounter.create({ companyId: testCompanyId, financialYear: fy, seq: initialSeq });

    const beforeDoc = await QuotationCounter.findOne({ companyId: testCompanyId, financialYear: fy });
    assert.strictEqual(beforeDoc?.seq, 20, "QuotationCounter must start at 20");

    // 2. Start session and transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 3. Generate quotation number inside transaction
      const qNum = await generateQuotationNumber(testCompanyId, new Date("2026-05-15"), session);
      assert.match(qNum, /0021$/, "Generated number inside transaction should end with 0021");

      // Verify inside transaction that seq is 21
      const inTxDoc = await QuotationCounter.findOne({ companyId: testCompanyId, financialYear: fy }).session(session);
      assert.strictEqual(inTxDoc?.seq, 21, "Inside transaction, QuotationCounter must be 21");

      // 4. Abort transaction
      await session.abortTransaction();
    } finally {
      await session.endSession();
    }

    // 5. Query outside transaction and assert sequence was NOT consumed
    const afterAbortDoc = await QuotationCounter.findOne({ companyId: testCompanyId, financialYear: fy });
    assert.strictEqual(
      afterAbortDoc?.seq,
      20,
      "QuotationCounter sequence must roll back to 20 after abort without consuming 21"
    );

    // Clean up
    await QuotationCounter.deleteMany({ companyId: testCompanyId });
  });

  test("Admission pre('save') hook uses session and rolls back admissionId counter on abort", async () => {
    // Record current admission counter sequence
    let currentAdmCounter = await Counter.findOne({ name: "admissionId" });
    if (!currentAdmCounter) {
      currentAdmCounter = await Counter.create({ name: "admissionId", seq: 100 });
    }
    const baselineSeq = currentAdmCounter.seq;

    // Start session & transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create admission instance and save with session
      const testAdmission = new Admission({
        fullName: "Test Transaction Student",
        mobileNumber: "9999988888",
        course: "Test Course",
      });

      // Save inside transaction - this triggers pre('save') with this.$session()
      await testAdmission.save({ session });

      assert.ok(testAdmission.admissionId, "Admission must have generated admissionId");

      // Check inside transaction counter incremented
      const inTxCounter = await Counter.findOne({ name: "admissionId" }).session(session);
      assert.strictEqual(inTxCounter?.seq, baselineSeq + 1, "Counter incremented inside transaction");

      // Abort transaction
      await session.abortTransaction();
    } finally {
      await session.endSession();
    }

    // Assert outside transaction that counter seq rolled back to baseline
    const afterAbortCounter = await Counter.findOne({ name: "admissionId" });
    assert.strictEqual(
      afterAbortCounter?.seq,
      baselineSeq,
      `Admission counter sequence must roll back to ${baselineSeq} after abort`
    );
  });
});
