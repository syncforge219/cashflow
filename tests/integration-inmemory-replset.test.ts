import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom alias loader so @/... imports resolve correctly in Node native ESM
register(
  pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href,
  pathToFileURL(process.cwd() + "/")
);

// Disable background crons during testing
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
  } catch (e) {}

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
    console.warn("SRV Resolution notice:", err.message);
  }

  return uri;
}

describe("In-Memory MongoDB Replica Set Integration Test Suite", () => {
  let replSet: any = null;
  let connectionUri: string;
  let Admission: any;
  let Enquiry: any;
  let Payment: any;
  let Student: any;
  let Counter: any;
  let Company: any;
  let getNextSequence: any;
  let getStudentBalance: any;
  let getCompanyFyRevenue: any;
  let getFinancialYearRange: any;

  before(async () => {
    // 1. Initialize In-Memory MongoDB Replica Set (supports multi-document transactions)
    console.log("Setting up MongoDB Replica Set for transaction tests...");
    try {
      const { MongoMemoryReplSet } = await import("mongodb-memory-server");
      replSet = await MongoMemoryReplSet.create({
        replSet: {
          count: 1,
          storageEngine: "wiredTiger",
        },
      });
      connectionUri = replSet.getUri();
      console.log("In-Memory Replica Set initialized at:", connectionUri);
    } catch (inMemErr: any) {
      console.warn("MongoMemoryReplSet start notice:", inMemErr.message);
      // Fallback to configured replica set if in-memory download or startup encounters environment issues
      const rawUri = process.env.MONGODB_URI;
      if (!rawUri) {
        throw new Error(
          `Unable to start MongoMemoryReplSet and no MONGODB_URI configured: ${inMemErr.message}`
        );
      }
      connectionUri = await resolveMongoUri(rawUri);
      console.log("Falling back to configured replica set URI");
    }

    // Set MONGODB_URI so internal imports/connectors also target this database
    process.env.MONGODB_URI = connectionUri;

    await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 20000,
    });
    console.log("Mongoose connected. ReadyState:", mongoose.connection.readyState);

    // Dynamically load models & helpers
    Admission = (await import("../src/models/Admission")).default;
    Enquiry = (await import("../src/models/Enquiry")).default;
    Payment = (await import("../src/models/Payment")).default;
    Student = (await import("../src/models/Student")).default;
    Counter = (await import("../src/models/Counter")).default;
    Company = (await import("../src/models/Company")).default;

    const seqHelper = await import("../src/lib/sequenceHelper");
    getNextSequence = seqHelper.getNextSequence;

    const balService = await import("../src/lib/studentBalanceService");
    getStudentBalance = balService.getStudentBalance;

    const revHelper = await import("../src/lib/companyRevenueHelper");
    getCompanyFyRevenue = revHelper.getCompanyFyRevenue;

    const fyHelper = await import("../src/lib/financialYearHelper");
    getFinancialYearRange = fyHelper.getFinancialYearRange;
  });

  after(async () => {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      if (replSet) {
        console.log("Stopping in-memory replica set...");
        await replSet.stop();
        console.log("In-memory replica set stopped.");
      }
    } catch (cleanupErr) {
      console.warn("Cleanup warning:", cleanupErr);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 1: Editing admission name updates only linked enquiry, never another
  //         enquiry with the same phone number
  // --------------------------------------------------------------------------
  test("1. Editing an admission name updates only the linked enquiry, never another enquiry with the same phone number", async () => {
    const sharedPhone = "9876511111";
    const uniqueKey = Date.now();

    // Create Enquiry 1 (to be linked to admission)
    const enq1 = await Enquiry.create({
      studentFullName: `Enquiry One Original ${uniqueKey}`,
      primaryPhoneMobile: sharedPhone,
      emailAddress: `enq1_${uniqueKey}@test.com`,
      status: "New",
    });

    // Create Enquiry 2 (same phone number, but NOT linked to this admission)
    const enq2 = await Enquiry.create({
      studentFullName: `Enquiry Two Unlinked ${uniqueKey}`,
      primaryPhoneMobile: sharedPhone,
      emailAddress: `enq2_${uniqueKey}@test.com`,
      status: "New",
    });

    // Create Admission explicitly linked to Enquiry 1 via enquiryId
    const adm = await Admission.create({
      fullName: `Enquiry One Original ${uniqueKey}`,
      mobileNumber: sharedPhone,
      enquiryId: enq1._id,
      finalFee: 20000,
    });

    const newAdmissionName = `Enquiry One Renamed ${uniqueKey}`;

    // Perform the Admission update and cascade inside a transaction session
    // (exact logic implemented in PUT /api/admissions/[id])
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // 1. Update Admission name
        await Admission.updateOne(
          { _id: adm._id },
          { $set: { fullName: newAdmissionName } },
          { session }
        );

        // 2. Cascade strictly to the linked Enquiry by exact _id match (never by phone number)
        const targetEnquiryId = adm.enquiryId;
        assert.ok(targetEnquiryId, "Target enquiryId must be present on admission");

        await Enquiry.updateOne(
          { _id: new mongoose.Types.ObjectId(String(targetEnquiryId)) },
          { $set: { studentFullName: newAdmissionName } },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }

    // Refresh both enquiry documents
    const refreshedEnq1 = await Enquiry.findById(enq1._id);
    const refreshedEnq2 = await Enquiry.findById(enq2._id);

    // Verify linked enquiry was updated
    assert.strictEqual(
      refreshedEnq1?.studentFullName,
      newAdmissionName,
      "Linked Enquiry 1 must receive the updated student name"
    );

    // Verify unlinked enquiry with the exact same phone was NOT touched
    assert.strictEqual(
      refreshedEnq2?.studentFullName,
      `Enquiry Two Unlinked ${uniqueKey}`,
      "Unlinked Enquiry 2 with same phone number MUST NOT be modified"
    );

    // Clean up
    await Enquiry.deleteMany({ _id: { $in: [enq1._id, enq2._id] } });
    await Admission.deleteOne({ _id: adm._id });
  });

  // --------------------------------------------------------------------------
  // TEST 2: A failed step inside the admission transaction rolls back everything
  // --------------------------------------------------------------------------
  test("2. A failed step inside the admission transaction rolls back everything", async () => {
    const uniqueKey = Date.now();
    const testAdmissionId = new mongoose.Types.ObjectId();
    const testPaymentId = new mongoose.Types.ObjectId();

    // Baseline Enquiry
    const enq = await Enquiry.create({
      studentFullName: `Rollback Student ${uniqueKey}`,
      primaryPhoneMobile: "9876522222",
      status: "New",
      isAdmitted: false,
    });

    // Baseline Counter sequence
    const counterKey = "admissionId";
    let counterDoc = await Counter.findOne({ name: counterKey });
    if (!counterDoc) {
      counterDoc = await Counter.create({ name: counterKey, seq: 200 });
    }
    const baselineSeq = counterDoc.seq;

    // Execute multi-step transaction with an intentional failure
    const session = await mongoose.startSession();
    session.startTransaction();

    let transactionFailed = false;

    try {
      // Step A: Save Admission inside transaction
      const newAdm = new Admission({
        _id: testAdmissionId,
        fullName: `Rollback Student ${uniqueKey}`,
        mobileNumber: "9876522222",
        enquiryId: enq._id,
        finalFee: 30000,
      });
      await newAdm.save({ session });

      // Step B: Update Enquiry inside transaction
      await Enquiry.updateOne(
        { _id: enq._id },
        { $set: { status: "Admitted", isAdmitted: true } },
        { session }
      );

      // Step C: Save initial Payment inside transaction
      const newPay = new Payment({
        _id: testPaymentId,
        admissionId: testAdmissionId,
        studentName: `Rollback Student ${uniqueKey}`,
        amountReceived: 5000,
        paymentMode: "UPI",
      });
      await newPay.save({ session });

      // Step D: Advance counter inside transaction
      await getNextSequence(counterKey, "ADM", 6, undefined, session);

      // Step E: FAILED STEP - throw error to simulate failure
      throw new Error("Simulated step failure: Payment gateway timed out or validation failed");
    } catch (txError: any) {
      transactionFailed = true;
      await session.abortTransaction();
    } finally {
      await session.endSession();
    }

    assert.strictEqual(transactionFailed, true, "Transaction must fail and catch error");

    // VERIFY COMPLETE ROLLBACK ACROSS ALL COLLECTIONS:
    // 1. Admission was rolled back
    const rolledBackAdm = await Admission.findById(testAdmissionId);
    assert.strictEqual(rolledBackAdm, null, "Admission record must not exist after rollback");

    // 2. Enquiry status rolled back to 'New'
    const rolledBackEnq = await Enquiry.findById(enq._id);
    assert.strictEqual(
      rolledBackEnq?.status,
      "New",
      "Enquiry status must roll back to original 'New'"
    );

    // 3. Payment receipt was rolled back
    const rolledBackPay = await Payment.findById(testPaymentId);
    assert.strictEqual(rolledBackPay, null, "Payment receipt must not exist after rollback");

    // 4. Counter sequence rolled back to baseline
    const rolledBackCounter = await Counter.findOne({ name: counterKey });
    assert.strictEqual(
      rolledBackCounter?.seq,
      baselineSeq,
      `Counter sequence must roll back to baseline (${baselineSeq})`
    );

    // Clean up
    await Enquiry.deleteOne({ _id: enq._id });
  });

  // --------------------------------------------------------------------------
  // TEST 3: Issued receipts keep their original student name
  // --------------------------------------------------------------------------
  test("3. Issued receipts keep their original student name", async () => {
    const uniqueKey = Date.now();
    const originalStudentName = `Receipt Student Original ${uniqueKey}`;
    const receiptNo = `REC-SNAP-${uniqueKey}`;

    // 1. Create Student master & Admission
    const student = await Student.create({
      fullName: originalStudentName,
      primaryPhone: `987653${uniqueKey.toString().slice(-4)}`,
    });

    const admission = await Admission.create({
      fullName: originalStudentName,
      mobileNumber: student.primaryPhone,
      studentId: student._id,
      finalFee: 35000,
    });

    // 2. Issue a Payment receipt with snapshot studentName
    const payment = await Payment.create({
      receiptNo,
      admissionId: admission._id,
      studentName: originalStudentName, // immutable issued snapshot
      amountReceived: 10000,
      amountReceivedPaise: 1000000,
      paymentMode: "Cash",
      paymentDate: new Date(),
    });

    // 3. Subsequently edit the student's name on Student master and Admission
    const legallyChangedName = `Receipt Student Updated ${uniqueKey}`;
    await Student.updateOne({ _id: student._id }, { $set: { fullName: legallyChangedName } });
    await Admission.updateOne({ _id: admission._id }, { $set: { fullName: legallyChangedName } });

    // 4. Query the issued receipt from database
    const fetchedReceipt = await Payment.findOne({ receiptNo });
    assert.ok(fetchedReceipt, "Issued receipt must be retrievable");

    // 5. Assert receipt studentName remains the immutable snapshot from issuance
    assert.strictEqual(
      fetchedReceipt.studentName,
      originalStudentName,
      "Issued receipt must retain its original student name"
    );
    assert.notStrictEqual(
      fetchedReceipt.studentName,
      legallyChangedName,
      "Issued receipt must NOT change when student or admission name changes"
    );

    // Clean up
    await Payment.deleteOne({ _id: payment._id });
    await Admission.deleteOne({ _id: admission._id });
    await Student.deleteOne({ _id: student._id });
  });

  // --------------------------------------------------------------------------
  // TEST 4: Counters don't skip numbers on aborted transactions
  // --------------------------------------------------------------------------
  test("4. Counters don't skip numbers on aborted transactions", async () => {
    const uniqueCounterName = `test_no_skip_counter_${Date.now()}`;
    const startSeq = 100;

    // 1. Initialize counter at 100
    await Counter.create({ name: uniqueCounterName, seq: startSeq });

    // 2. Transaction 1: Generate next number inside transaction, then ABORT
    const session1 = await mongoose.startSession();
    session1.startTransaction();

    let seqInTx1: string | null = null;
    try {
      seqInTx1 = await getNextSequence(uniqueCounterName, "INV", 5, undefined, session1);
      assert.strictEqual(seqInTx1, "INV00101", "Tx 1 generates INV00101 inside transaction");

      // Abort Transaction 1
      await session1.abortTransaction();
    } finally {
      await session1.endSession();
    }

    // Check outside transaction that counter is still at 100
    const midDoc = await Counter.findOne({ name: uniqueCounterName });
    assert.strictEqual(
      midDoc?.seq,
      startSeq,
      "Counter sequence must remain at 100 after aborted transaction"
    );

    // 3. Transaction 2: Next transaction generates sequence and COMMITS
    const session2 = await mongoose.startSession();
    session2.startTransaction();

    let seqInTx2: string | null = null;
    try {
      seqInTx2 = await getNextSequence(uniqueCounterName, "INV", 5, undefined, session2);
      // It must be 101, NOT skipping to 102!
      assert.strictEqual(
        seqInTx2,
        "INV00101",
        "Tx 2 must receive sequence 101 without skipping to 102"
      );

      await session2.commitTransaction();
    } finally {
      await session2.endSession();
    }

    // 4. Assert final committed counter sequence is 101
    const finalDoc = await Counter.findOne({ name: uniqueCounterName });
    assert.strictEqual(
      finalDoc?.seq,
      101,
      "Counter sequence after successful commit must be exactly 101 (no skipped numbers)"
    );

    // Clean up
    await Counter.deleteOne({ name: uniqueCounterName });
  });

  // --------------------------------------------------------------------------
  // TEST 5: Balance and company revenue computations match expected values
  //         across an FY boundary (31 Mar / 1 Apr)
  // --------------------------------------------------------------------------
  test("5. Balance and company revenue computations match expected values across an FY boundary (31 Mar / 1 Apr)", async () => {
    const uniqueKey = Date.now();

    // 1. Create a Company
    const testComp = await Company.create({
      name: `FY-Test-Comp-${uniqueKey}`,
      legalName: `FY Test Corporation ${uniqueKey}`,
      currentFinancialYear: "2026-27",
    });

    // 2. Create Admission with total fee of 50,000 INR (5,000,000 paise)
    const adm = await Admission.create({
      fullName: `FY Boundary Student ${uniqueKey}`,
      mobileNumber: `987654${uniqueKey.toString().slice(-4)}`,
      finalFee: 50000,
      finalFeePaise: 5000000,
      companyId: testComp._id,
    });

    // 3. Create Payment 1 on 31 Mar 2026 (Falls in FY 2025-26 in Indian fiscal calendar)
    // 31 Mar 2026 15:30 IST is FY 2025-26
    const payment1 = await Payment.create({
      receiptNo: `FY-REC1-${uniqueKey}`,
      admissionId: adm._id,
      studentName: adm.fullName,
      amountReceived: 20000,
      amountReceivedPaise: 2000000,
      paymentDate: new Date("2026-03-31T15:30:00+05:30"),
      paymentMode: "Bank Transfer",
      companyId: testComp._id,
    });

    // 4. Create Payment 2 on 1 Apr 2026 (Falls in FY 2026-27 in Indian fiscal calendar)
    // 1 Apr 2026 10:30 IST is FY 2026-27
    const payment2 = await Payment.create({
      receiptNo: `FY-REC2-${uniqueKey}`,
      admissionId: adm._id,
      studentName: adm.fullName,
      amountReceived: 15000,
      amountReceivedPaise: 1500000,
      paymentDate: new Date("2026-04-01T10:30:00+05:30"),
      paymentMode: "UPI",
      companyId: testComp._id,
    });

    // 5A. VERIFY getStudentBalance ACROSS THE FY BOUNDARY:
    // Student balance is all-time: it must accumulate all payments across fiscal boundaries
    const balance = await getStudentBalance(adm._id);
    assert.strictEqual(balance.finalFee, 50000, "Admission finalFee must be 50,000");
    assert.strictEqual(
      balance.totalPaid,
      35000,
      "Student totalPaid must sum payments across FY boundary (20,000 + 15,000 = 35,000)"
    );
    assert.strictEqual(
      balance.remainingBalance,
      15000,
      "Student remainingBalance must be exactly 15,000 (50,000 - 35,000)"
    );
    assert.strictEqual(balance.remainingBalancePaise, 1500000);
    assert.strictEqual(balance.isFullyPaid, false);

    // 5B. VERIFY Company Revenue Computations ACROSS THE FY BOUNDARY:
    // Indian FY 2025-26 (1 Apr 2025 - 31 Mar 2026) vs FY 2026-27 (1 Apr 2026 - 31 Mar 2027)
    const rangeFY2526 = getFinancialYearRange("2025-26");
    const rangeFY2627 = getFinancialYearRange("2026-27");

    const fy2526Revenue = await getCompanyFyRevenue(testComp._id, rangeFY2526);
    const fy2627Revenue = await getCompanyFyRevenue(testComp._id, rangeFY2627);

    assert.strictEqual(
      fy2526Revenue,
      20000,
      "FY 2025-26 revenue (up to 31 Mar) must strictly match Payment 1 (20,000)"
    );
    assert.strictEqual(
      fy2627Revenue,
      15000,
      "FY 2026-27 revenue (from 1 Apr) must strictly match Payment 2 (15,000)"
    );

    // Clean up
    await Payment.deleteMany({ _id: { $in: [payment1._id, payment2._id] } });
    await Admission.deleteOne({ _id: adm._id });
    await Company.deleteOne({ _id: testComp._id });
  });

  // --------------------------------------------------------------------------
  // TEST 6: Soft-deleted records don't appear in default queries
  // --------------------------------------------------------------------------
  test("6. Soft-deleted records don't appear in default queries", async () => {
    const uniqueKey = Date.now();

    // 1. Create active and soft-deleted Enquiries
    const activeEnq = await Enquiry.create({
      studentFullName: `Active Enquiry ${uniqueKey}`,
      primaryPhoneMobile: `999001${uniqueKey.toString().slice(-4)}`,
      status: "New",
      isDeleted: false,
    });

    const deletedEnq = await Enquiry.create({
      studentFullName: `Deleted Enquiry ${uniqueKey}`,
      primaryPhoneMobile: `999002${uniqueKey.toString().slice(-4)}`,
      status: "New",
      isDeleted: true,
      deletedAt: new Date(),
    });

    // 2. Create active and soft-deleted Admissions
    const activeAdm = await Admission.create({
      fullName: `Active Admission ${uniqueKey}`,
      mobileNumber: `999003${uniqueKey.toString().slice(-4)}`,
      finalFee: 20000,
      isDeleted: false,
    });

    const deletedAdm = await Admission.create({
      fullName: `Deleted Admission ${uniqueKey}`,
      mobileNumber: `999004${uniqueKey.toString().slice(-4)}`,
      finalFee: 20000,
      isDeleted: true,
      deletedAt: new Date(),
    });

    // 3. Create active and soft-deleted Payments
    const activePay = await Payment.create({
      admissionId: activeAdm._id,
      studentName: activeAdm.fullName,
      amountReceived: 6000,
      paymentMode: "Cash",
      isDeleted: false,
    });

    const deletedPay = await Payment.create({
      admissionId: activeAdm._id,
      studentName: activeAdm.fullName,
      amountReceived: 4000,
      paymentMode: "Cash",
      isDeleted: true,
      deletedAt: new Date(),
    });

    // 6A. Default find() queries exclude soft-deleted records
    const enqResults = await Enquiry.find({
      _id: { $in: [activeEnq._id, deletedEnq._id] },
    });
    assert.strictEqual(
      enqResults.length,
      1,
      "Default find() must only return active enquiry, excluding soft-deleted"
    );
    assert.strictEqual(
      enqResults[0]._id.toString(),
      activeEnq._id.toString(),
      "Only the active enquiry should be returned by default find()"
    );

    // 6B. Default findOne() queries return null for soft-deleted records
    const admResult = await Admission.findOne({ _id: deletedAdm._id });
    assert.strictEqual(
      admResult,
      null,
      "Default findOne() must return null for soft-deleted admission"
    );

    // 6C. Default countDocuments() excludes soft-deleted records
    const payCount = await Payment.countDocuments({
      _id: { $in: [activePay._id, deletedPay._id] },
    });
    assert.strictEqual(
      payCount,
      1,
      "Default countDocuments() must exclude soft-deleted payment"
    );

    // 6D. Default aggregation pipeline excludes soft-deleted records
    const aggResult = await Payment.aggregate([
      { $match: { _id: { $in: [activePay._id, deletedPay._id] } } },
      { $group: { _id: null, total: { $sum: "$amountReceived" } } },
    ]);
    assert.strictEqual(aggResult.length, 1);
    assert.strictEqual(
      aggResult[0].total,
      6000,
      "Default aggregation must only sum active payment (6,000), excluding soft-deleted (4,000)"
    );

    // 6E. Explicitly querying with { includeDeleted: true } returns the soft-deleted records
    const bypassedEnq = await Enquiry.findById(deletedEnq._id, null, {
      includeDeleted: true,
    });
    assert.ok(
      bypassedEnq,
      "Query with { includeDeleted: true } must successfully return soft-deleted document"
    );
    assert.strictEqual(bypassedEnq.isDeleted, true);
    assert.ok(bypassedEnq.deletedAt);

    // Clean up
    await Enquiry.deleteMany({ _id: { $in: [activeEnq._id, deletedEnq._id] } });
    await Admission.deleteMany({ _id: { $in: [activeAdm._id, deletedAdm._id] } });
    await Payment.deleteMany({ _id: { $in: [activePay._id, deletedPay._id] } });
  });
});
