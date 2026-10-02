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

describe("Phase B Reference Migration Test Suite", () => {
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

  let testBrand: any;
  let testCompany: any;
  let testCounsellor: any;

  before(async () => {
    const rawUri = process.env.MONGODB_URI || "mongodb://localhost:27017/syncforge_db";
    const resolvedUri = await resolveMongoUri(rawUri);
    process.env.MONGODB_URI = resolvedUri;

    const dbModule = await import("../src/lib/db");
    dbConnect = dbModule.default;
    await dbConnect();

    const admissionMod = await import("../src/models/Admission");
    const enquiryMod = await import("../src/models/Enquiry");
    const paymentMod = await import("../src/models/Payment");
    const expenseMod = await import("../src/models/Expense");
    const batchMod = await import("../src/models/Batch");
    const courseMod = await import("../src/models/Course");
    const brandMod = await import("../src/models/Brand");
    const companyMod = await import("../src/models/Company");
    const userMod = await import("../src/models/User");

    Admission = admissionMod.default;
    Enquiry = enquiryMod.default;
    Payment = paymentMod.default;
    Expense = expenseMod.default;
    Batch = batchMod.default;
    Course = courseMod.default;
    Brand = brandMod.default;
    Company = companyMod.default;
    User = userMod.default;

    // Create unique test fixtures
    testBrand = await Brand.create({
      name: `PHASEB-BRAND-${Date.now()}`,
      code: `PB${Date.now().toString().slice(-4)}`,
      brandType: "Corporate",
      isActive: true,
    });

    testCompany = await Company.create({
      name: `PHASEB-CORP-${Date.now()}`,
      legalName: `Phase B Corp Pvt Ltd ${Date.now()}`,
      gstin: `07AAAAA${Date.now().toString().slice(-4)}A1Z5`,
      annualThreshold: 2000000,
      monthlyThreshold: 200000,
      brands: [testBrand.name],
      brand: testBrand.name,
      isActive: true,
    });

    testCounsellor = await User.create({
      name: `Phase B Counsellor ${Date.now()}`,
      email: `phaseb_counsellor_${Date.now()}@test.com`,
      role: "counsellor",
      brandScope: testBrand.name,
      password: "TestPassword123!",
    });
  });

  after(async () => {
    // Cleanup fixtures
    if (testBrand) await Brand.deleteOne({ _id: testBrand._id });
    if (testCompany) await Company.deleteOne({ _id: testCompany._id });
    if (testCounsellor) await User.deleteOne({ _id: testCounsellor._id });

    await Admission.deleteMany({ brandId: testBrand?._id });
    await Enquiry.deleteMany({ targetBrandId: testBrand?._id });
    await Payment.deleteMany({ brandId: testBrand?._id });
    await Expense.deleteMany({ brandId: testBrand?._id });
    await Batch.deleteMany({ brandId: testBrand?._id });
    await Course.deleteMany({ brandId: testBrand?._id });

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  test("1. Schema indexes correctly prioritize ID fields across models", async () => {
    const admissionIndexes = Admission.schema.indexes();
    const hasAdmBrandIdIdx = admissionIndexes.some((idx: any) => idx[0].brandId !== undefined);
    const hasAdmCompanyIdIdx = admissionIndexes.some((idx: any) => idx[0].companyId !== undefined);
    const hasAdmCounsellorIdIdx = admissionIndexes.some((idx: any) => idx[0].counsellorId !== undefined);
    assert.strictEqual(hasAdmBrandIdIdx, true, "Admission must index brandId");
    assert.strictEqual(hasAdmCompanyIdIdx, true, "Admission must index companyId");
    assert.strictEqual(hasAdmCounsellorIdIdx, true, "Admission must index counsellorId");

    const enquiryIndexes = Enquiry.schema.indexes();
    const hasEnqTargetBrandId = enquiryIndexes.some((idx: any) => idx[0].targetBrandId !== undefined);
    const hasEnqAdvisorId = enquiryIndexes.some((idx: any) => idx[0].assignedCrmAdvisorId !== undefined);
    assert.strictEqual(hasEnqTargetBrandId, true, "Enquiry must index targetBrandId");
    assert.strictEqual(hasEnqAdvisorId, true, "Enquiry must index assignedCrmAdvisorId");

    const expenseIndexes = Expense.schema.indexes();
    const hasExpBrandId = expenseIndexes.some((idx: any) => idx[0].brandId !== undefined);
    const hasExpCompId = expenseIndexes.some((idx: any) => idx[0].companyId !== undefined);
    assert.strictEqual(hasExpBrandId, true, "Expense must index brandId");
    assert.strictEqual(hasExpCompId, true, "Expense must index companyId");

    const paymentIndexes = Payment.schema.indexes();
    const hasPayBrandId = paymentIndexes.some((idx: any) => idx[0].brandId !== undefined);
    const hasPayCompId = paymentIndexes.some((idx: any) => idx[0].companyId !== undefined);
    assert.strictEqual(hasPayBrandId, true, "Payment must index brandId");
    assert.strictEqual(hasPayCompId, true, "Payment must index companyId");
  });

  test("2. Enquiry queries and filters match by targetBrandId and assignedCrmAdvisorId", async () => {
    const enq = await Enquiry.create({
      studentFullName: "Phase B Student",
      primaryPhoneMobile: "9876543210",
      targetBrand: testBrand.name,
      targetBrandId: testBrand._id,
      assignedCrmAdvisor: testCounsellor.name,
      assignedCrmAdvisorId: testCounsellor._id,
      targetCourse: "AutoCAD",
      status: "New",
    });

    assert.ok(enq._id);

    // Query strictly by targetBrandId
    const foundByBrandId = await Enquiry.find({ targetBrandId: testBrand._id }).lean();
    assert.ok(foundByBrandId.length >= 1);
    assert.strictEqual(foundByBrandId[0]._id.toString(), enq._id.toString());

    // Query strictly by assignedCrmAdvisorId
    const foundByAdvisorId = await Enquiry.find({ assignedCrmAdvisorId: testCounsellor._id }).lean();
    assert.ok(foundByAdvisorId.length >= 1);
    assert.strictEqual(foundByAdvisorId[0]._id.toString(), enq._id.toString());
  });

  test("3. Admission queries and filters match by brandId, companyId, and counsellorId", async () => {
    const adm = await Admission.create({
      fullName: "Phase B Admitted Candidate",
      mobileNumber: "9876543211",
      email: "phaseb_adm@test.com",
      course: "SolidWorks",
      brand: testBrand.name,
      brandId: testBrand._id,
      companyAssigned: testCompany.name,
      companyId: testCompany._id,
      counsellor: testCounsellor.name,
      counsellorId: testCounsellor._id,
      courseFee: 25000,
      finalFee: 25000,
      amountReceivedToday: 10000,
      balanceAmount: 15000,
      admissionDate: new Date(),
    });

    assert.ok(adm._id);

    // Query strictly by companyId
    const foundByCompanyId = await Admission.find({ companyId: testCompany._id }).lean();
    assert.ok(foundByCompanyId.length >= 1);
    assert.strictEqual(foundByCompanyId[0]._id.toString(), adm._id.toString());

    // Query strictly by counsellorId
    const foundByCounsellorId = await Admission.find({ counsellorId: testCounsellor._id }).lean();
    assert.ok(foundByCounsellorId.length >= 1);
    assert.strictEqual(foundByCounsellorId[0]._id.toString(), adm._id.toString());

    // Query strictly by brandId
    const foundByBrandId = await Admission.find({ brandId: testBrand._id }).lean();
    assert.ok(foundByBrandId.length >= 1);
    assert.strictEqual(foundByBrandId[0]._id.toString(), adm._id.toString());
  });

  test("4. GST Capacity aggregation groups by companyId and matches company._id", async () => {
    const adm = await Admission.findOne({ companyId: testCompany._id });
    assert.ok(adm);

    // Simulate GST capacity pipeline: group admissions and payments by companyId
    const admissionsByCompany = await Admission.aggregate([
      {
        $match: {
          companyId: testCompany._id,
        },
      },
      {
        $group: {
          _id: { companyId: "$companyId", companyName: "$companyAssigned" },
          totalTurnover: {
            $sum: {
              $cond: [
                { $gt: ["$finalFee", 0] },
                "$finalFee",
                {
                  $cond: [
                    { $gt: ["$courseFee", 0] },
                    "$courseFee",
                    { $ifNull: ["$registrationAmount", 0] }
                  ]
                }
              ]
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    assert.ok(admissionsByCompany.length >= 1);
    const aggResult = admissionsByCompany[0];
    const pCompId = String(aggResult._id.companyId || "");
    const compIdStr = String(testCompany._id);

    // Assert that companyId is exact match
    assert.strictEqual(pCompId, compIdStr, "Aggregation group must match company._id directly");
    assert.strictEqual(aggResult.totalTurnover, 25000);
    assert.strictEqual(aggResult.count, 1);
  });

  test("5. Payment collections and reports populate brandId and companyId references", async () => {
    const adm = await Admission.findOne({ companyId: testCompany._id });
    assert.ok(adm);

    const payment = await Payment.create({
      admissionId: adm._id,
      amountReceived: 10000,
      paymentMode: "UPI",
      studentName: adm.fullName,
      brand: testBrand.name,
      brandId: testBrand._id,
      company: testCompany.name,
      companyId: testCompany._id,
      paymentDate: new Date(),
    });

    assert.ok(payment._id);

    const populatedPayment = await Payment.findById(payment._id)
      .populate("brandId", "name code")
      .populate("companyId", "name legalName gstin")
      .lean();

    assert.ok(populatedPayment.brandId, "Payment must populate brandId");
    assert.strictEqual(populatedPayment.brandId.name, testBrand.name);
    assert.ok(populatedPayment.companyId, "Payment must populate companyId");
    assert.strictEqual(populatedPayment.companyId.name, testCompany.name);
  });

  test("6. Legacy string fields remain intact as read-only fallback", async () => {
    const adm = await Admission.findOne({ companyId: testCompany._id }).lean();
    assert.ok(adm);
    assert.strictEqual(adm.brand, testBrand.name, "Legacy brand string preserved");
    assert.strictEqual(adm.companyAssigned, testCompany.name, "Legacy companyAssigned string preserved");
    assert.strictEqual(adm.counsellor, testCounsellor.name, "Legacy counsellor string preserved");

    const enq = await Enquiry.findOne({ targetBrandId: testBrand._id }).lean();
    assert.ok(enq);
    assert.strictEqual(enq.targetBrand, testBrand.name, "Legacy targetBrand string preserved");
    assert.strictEqual(enq.assignedCrmAdvisor, testCounsellor.name, "Legacy assignedCrmAdvisor string preserved");
  });
});
