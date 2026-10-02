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
  } catch (err: any) {}

  return uri;
}

describe("Reference Dual-Write & Expand-Migrate-Contract Test Suite", () => {
  let dbConnect: any;
  let Admission: any;
  let Enquiry: any;
  let Payment: any;
  let Expense: any;
  let Batch: any;
  let Course: any;
  let Brand: any;
  let Company: any;
  let User: any;
  let syncAdmissionRefs: any;
  let syncEnquiryRefs: any;
  let syncPaymentRefs: any;
  let syncExpenseRefs: any;
  let syncBatchRefs: any;
  let syncCourseRefs: any;
  let lookupBrand: any;
  let lookupCompany: any;
  let lookupUser: any;

  before(async () => {
    const dbModule = await import("@/lib/db");
    dbConnect = dbModule.default;

    const admMod = await import("@/models/Admission");
    Admission = admMod.default;

    const enqMod = await import("@/models/Enquiry");
    Enquiry = enqMod.default;

    const payMod = await import("@/models/Payment");
    Payment = payMod.default;

    const expMod = await import("@/models/Expense");
    Expense = expMod.default;

    const batMod = await import("@/models/Batch");
    Batch = batMod.default;

    const couMod = await import("@/models/Course");
    Course = couMod.default;

    const brdMod = await import("@/models/Brand");
    Brand = brdMod.default;

    const cmpMod = await import("@/models/Company");
    Company = cmpMod.default;

    const usrMod = await import("@/models/User");
    User = usrMod.default;

    const refHelper = await import("@/lib/referenceHelper");
    syncAdmissionRefs = refHelper.syncAdmissionRefs;
    syncEnquiryRefs = refHelper.syncEnquiryRefs;
    syncPaymentRefs = refHelper.syncPaymentRefs;
    syncExpenseRefs = refHelper.syncExpenseRefs;
    syncBatchRefs = refHelper.syncBatchRefs;
    syncCourseRefs = refHelper.syncCourseRefs;
    lookupBrand = refHelper.lookupBrand;
    lookupCompany = refHelper.lookupCompany;
    lookupUser = refHelper.lookupUser;

    const rawUri = process.env.MONGODB_URI;
    if (!rawUri) {
      throw new Error("MONGODB_URI is required for tests.");
    }
    const resolvedUri = await resolveMongoUri(rawUri);
    await mongoose.connect(resolvedUri, {
      bufferCommands: true,
      serverSelectionTimeoutMS: 10000,
    });
  });

  after(async () => {
    await mongoose.disconnect();
  });

  test("lookupBrand resolves exact matches and rejects nonexistent brands", async () => {
    const resMatched = await lookupBrand("CADD MANTRA");
    assert.equal(resMatched.status, "matched");
    assert.ok(resMatched.record?._id);

    const resNonexistent = await lookupBrand("Nonexistent Unknown Brand");
    assert.equal(resNonexistent.status, "zero");
    assert.equal(resNonexistent.record, undefined);

    const resAllBrands = await lookupBrand("All Brands");
    assert.equal(resAllBrands.status, "zero");
  });

  test("lookupCompany resolves exact matches and skips Cash / Unallocated", async () => {
    const resMatched = await lookupCompany("INSTITUE OF CREATIVE STUDIES");
    assert.equal(resMatched.status, "matched");
    assert.ok(resMatched.record?._id);

    const resCash = await lookupCompany("Cash");
    assert.equal(resCash.status, "zero");

    const resUnallocated = await lookupCompany("Unallocated");
    assert.equal(resUnallocated.status, "zero");
  });

  test("lookupUser resolves exact matches and skips Unassigned", async () => {
    const resMatched = await lookupUser("Addu Dubey");
    assert.equal(resMatched.status, "matched");
    assert.ok(resMatched.record?._id);

    const resUnassigned = await lookupUser("Unassigned");
    assert.equal(resUnassigned.status, "zero");
  });

  test("syncAdmissionRefs dual-writes both string -> ObjectId and ObjectId -> string", async () => {
    const brandDoc = await Brand.findOne({ name: "CADD MANTRA" }).lean();
    assert.ok(brandDoc);

    // Case 1: String provided -> populates ObjectId
    const doc1: any = { brand: "CADD MANTRA" };
    await syncAdmissionRefs(doc1);
    assert.ok(doc1.brandId);
    assert.equal(doc1.brandId.toString(), brandDoc._id.toString());

    // Case 2: ObjectId provided -> populates string name
    const doc2: any = { brandId: brandDoc._id };
    await syncAdmissionRefs(doc2);
    assert.equal(doc2.brand, "CADD MANTRA");

    // Case 3: Nonexistent string -> leaves brandId undefined (no guessing)
    const doc3: any = { brand: "Nonexistent Random Brand XYZ" };
    await syncAdmissionRefs(doc3);
    assert.equal(doc3.brandId, undefined);
  });

  test("Admission pre-save hook automatically populates brandId, companyId, and counsellorId", async () => {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const testAdm = new Admission({
          fullName: "DualWrite Test Student",
          mobileNumber: "9999900001",
          brand: "CADD MANTRA",
          companyAssigned: "CT ENTERPRISES",
          counsellor: "Addu Dubey",
        });

        await testAdm.save({ session });

        // Assert pre-save hook populated all 3 ObjectId fields
        assert.ok(testAdm.brandId, "brandId should be populated by pre-save hook");
        assert.ok(testAdm.companyId, "companyId should be populated by pre-save hook");
        assert.ok(testAdm.counsellorId, "counsellorId should be populated by pre-save hook");
        assert.equal(testAdm.brand, "CADD MANTRA");
        assert.equal(testAdm.companyAssigned, "CT ENTERPRISES");
        assert.equal(testAdm.counsellor, "Addu Dubey");

        // Force rollback so test data does not remain in database
        throw new Error("ROLLBACK_TEST_DUALWRITE");
      });
    } catch (err: any) {
      assert.equal(err.message, "ROLLBACK_TEST_DUALWRITE");
    } finally {
      await session.endSession();
    }
  });

  test("Payment pre-save hook automatically populates brandId and companyId", async () => {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const testPay = new Payment({
          admissionId: new mongoose.Types.ObjectId(),
          studentName: "DualWrite Test Student",
          amountReceived: 1000,
          paymentMode: "Cash",
          brand: "CADD MANTRA",
          company: "CT ENTERPRISES",
        });

        await testPay.save({ session });

        assert.ok(testPay.brandId, "Payment.brandId should be populated");
        assert.ok(testPay.companyId, "Payment.companyId should be populated");
        assert.equal(testPay.brand, "CADD MANTRA");
        assert.equal(testPay.company, "CT ENTERPRISES");

        throw new Error("ROLLBACK_TEST_PAYMENT");
      });
    } catch (err: any) {
      assert.equal(err.message, "ROLLBACK_TEST_PAYMENT");
    } finally {
      await session.endSession();
    }
  });

  test("Enquiry pre-save hook automatically populates targetBrandId and assignedCrmAdvisorId", async () => {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const testEnq = new Enquiry({
          studentFullName: "DualWrite Test Lead",
          primaryPhoneMobile: "9999900002",
          targetBrand: "CADD MANTRA",
          assignedCrmAdvisor: "Addu Dubey",
        });

        await testEnq.save({ session });

        assert.ok(testEnq.targetBrandId, "Enquiry.targetBrandId should be populated");
        assert.ok(testEnq.assignedCrmAdvisorId, "Enquiry.assignedCrmAdvisorId should be populated");
        assert.equal(testEnq.targetBrand, "CADD MANTRA");
        assert.equal(testEnq.assignedCrmAdvisor, "Addu Dubey");

        throw new Error("ROLLBACK_TEST_ENQUIRY");
      });
    } catch (err: any) {
      assert.equal(err.message, "ROLLBACK_TEST_ENQUIRY");
    } finally {
      await session.endSession();
    }
  });

  test("Expense, Batch, and Course pre-save hooks automatically populate brandId and companyId", async () => {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // 1. Expense
        const testExp = new Expense({
          title: "Test DualWrite Expense",
          amount: 500,
          brand: "CADD MANTRA",
          company: "CT ENTERPRISES",
        });
        await testExp.save({ session });
        assert.ok(testExp.brandId, "Expense.brandId should be populated");
        assert.ok(testExp.companyId, "Expense.companyId should be populated");

        // 2. Batch
        const testBat = new Batch({
          batchName: "Test DualWrite Batch",
          course: "AutoCAD",
          teacherId: new mongoose.Types.ObjectId(),
          teacherName: "Faculty Test",
          brand: "DESIGN GATEWAY",
          startDate: new Date(),
          timing: "10:00 AM",
        });
        await testBat.save({ session });
        assert.ok(testBat.brandId, "Batch.brandId should be populated");

        // 3. Course
        const testCou = new Course({
          name: "Test DualWrite Course",
          code: "TEST-DW-001",
          brand: "CADD MANTRA",
          category: "CAD",
          duration: "3 Months",
          fee: "15000",
        });
        await testCou.save({ session });
        assert.ok(testCou.brandId, "Course.brandId should be populated");

        throw new Error("ROLLBACK_TEST_MODELS");
      });
    } catch (err: any) {
      assert.equal(err.message, "ROLLBACK_TEST_MODELS");
    } finally {
      await session.endSession();
    }
  });
});
