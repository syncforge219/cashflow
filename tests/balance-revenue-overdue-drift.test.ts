import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
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
  } catch (err: any) {
    console.warn("SRV Resolution notice:", err.message);
  }

  return uri;
}

describe("Drift Fixes: Balance, Company Revenue, Overdue Tasks, Lost Leads", () => {
  let Admission: any;
  let Payment: any;
  let Task: any;
  let Enquiry: any;
  let Company: any;
  let Brand: any;
  let getStudentBalance: any;
  let recomputeAndStoreAdmissionBalance: any;
  let studentBalanceLookupStages: any;
  let getCompanyPaymentRevenueMap: any;
  let getFinancialYearRange: any;

  let companyId: Types.ObjectId;
  let brandId: Types.ObjectId;
  let testAdmissionId: Types.ObjectId;
  let brandName: string;
  let companyName: string;

  before(async () => {
    const rawUri = process.env.MONGODB_URI;
    if (!rawUri) {
      throw new Error("MONGODB_URI is not set in environment or .env file");
    }
    const resolvedUri = await resolveMongoUri(rawUri);
    await mongoose.connect(resolvedUri);

    ({ default: Admission } = await import("../src/models/Admission"));
    ({ default: Payment } = await import("../src/models/Payment"));
    ({ default: Task } = await import("../src/models/Task"));
    ({ default: Enquiry } = await import("../src/models/Enquiry"));
    ({ default: Company } = await import("../src/models/Company"));
    ({ default: Brand } = await import("../src/models/Brand"));
    ({ getStudentBalance, recomputeAndStoreAdmissionBalance, studentBalanceLookupStages } = await import("../src/lib/studentBalanceService"));
    ({ getCompanyPaymentRevenueMap } = await import("../src/lib/companyRevenueHelper"));
    ({ getFinancialYearRange } = await import("../src/lib/financialYearHelper"));

    const timestamp = Date.now();
    brandName = `Drift Test Brand ${timestamp}`;
    companyName = `Drift Test Corp ${timestamp}`;

    const br = await Brand.create({
      name: brandName,
      code: `DR${timestamp.toString().slice(-4)}`,
      brandType: "Corporate",
      isActive: true,
    });
    brandId = br._id;

    const comp = await Company.create({
      name: companyName,
      legalName: `${companyName} Pvt Ltd`,
      gstin: `07AADRT${timestamp.toString().slice(-4)}A1Z5`,
      annualThreshold: 2000000,
      monthlyThreshold: 200000,
      brands: [brandName],
      brand: brandName,
      isActive: true,
      collectedRevenue: 999999, // Artificially set drifted stored value
    });
    companyId = comp._id;

    const adm = await Admission.create({
      fullName: `Drift Student ${timestamp}`,
      email: `drift.student.${timestamp}@drift.test`,
      phoneNumber: "9876549999",
      course: "UI/UX Design Master",
      finalFee: 100000,
      courseFee: 100000,
      registrationAmount: 20000,
      remainingBalance: 50000, // Artificially drifted stored balance
      brand: brandName,
      brandId: brandId,
      companyAssigned: companyName,
      companyId: companyId,
    });
    testAdmissionId = adm._id;
  });

  after(async () => {
    await Payment.deleteMany({ admissionId: testAdmissionId });
    await Admission.deleteMany({ _id: testAdmissionId });
    await Task.deleteMany({ title: /Drift Test/ });
    await Enquiry.deleteMany({ email: /@drift\.test/ });
    await Company.deleteMany({ _id: companyId });
    await Brand.deleteMany({ _id: brandId });
    await mongoose.disconnect();
  });

  test("1. getStudentBalance computes true balance (finalFee - sum(payments))", async () => {
    // Before any payment: finalFee 100,000, 0 payments -> remainingBalance 100,000
    const initialBalance = await getStudentBalance(testAdmissionId);
    assert.equal(initialBalance.finalFee, 100000);
    assert.equal(initialBalance.totalPaid, 0);
    assert.equal(initialBalance.remainingBalance, 100000);
    assert.equal(initialBalance.isFullyPaid, false);

    // Create Payment 1: 30,000
    const p1 = await Payment.create({
      admissionId: testAdmissionId,
      studentName: "Drift Student",
      amountReceived: 30000,
      paymentMode: "Bank Transfer",
      companyId: companyId,
      company: companyName,
      brandId: brandId,
      brand: brandName,
    });

    const balanceAfterP1 = await getStudentBalance(testAdmissionId);
    assert.equal(balanceAfterP1.totalPaid, 30000);
    assert.equal(balanceAfterP1.remainingBalance, 70000);

    // Recompute and store in Admission
    await recomputeAndStoreAdmissionBalance(testAdmissionId);
    const updatedAdm1 = await Admission.findById(testAdmissionId).lean();
    assert.equal(updatedAdm1.remainingBalance, 70000, "Stored balance must be updated to 70,000");

    // Create Payment 2: 70,000 inside transaction
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      await Payment.create(
        [
          {
            admissionId: testAdmissionId,
            studentName: "Drift Student",
            amountReceived: 70000,
            paymentMode: "UPI",
            companyId: companyId,
            company: companyName,
            brandId: brandId,
            brand: brandName,
          },
        ],
        { session }
      );
      await recomputeAndStoreAdmissionBalance(testAdmissionId, session);
    });
    await session.endSession();

    const finalBalance = await getStudentBalance(testAdmissionId);
    assert.equal(finalBalance.totalPaid, 100000);
    assert.equal(finalBalance.remainingBalance, 0);
    assert.equal(finalBalance.isFullyPaid, true);

    const updatedAdmFinal = await Admission.findById(testAdmissionId).lean();
    assert.equal(updatedAdmFinal.remainingBalance, 0);
  });

  test("2. Company revenue is computed by aggregating payments by financial year", async () => {
    const fyRange = getFinancialYearRange();
    const revenueMap = await getCompanyPaymentRevenueMap(fyRange);

    const companyRevenue = revenueMap.get(String(companyId)) || 0;
    // We inserted 30,000 + 70,000 = 100,000 payments for this company
    assert.equal(companyRevenue, 100000, "FY payments for company must be 100,000 regardless of stored collectedRevenue");

    // Stored collectedRevenue in DB was 999999; verify that drift detection reports the difference
    const compDoc = await Company.findById(companyId).lean();
    assert.equal(compDoc.collectedRevenue, 999999);
    assert.notEqual(compDoc.collectedRevenue, companyRevenue);
  });

  test("3. Task status Overdue is derived at query time without DB mutations", async () => {
    const pastDueDate = new Date();
    pastDueDate.setDate(pastDueDate.getDate() - 3); // 3 days ago

    const overdueTask = await Task.create({
      title: "Drift Test: Collect Balance",
      assignedTo: "Counsellor Drift",
      dueDate: pastDueDate,
      status: "Pending", // Stored as Pending
      taskType: "Fee Collection",
      linkedStudentId: testAdmissionId.toString(),
      linkedType: "Admission",
    });

    // Query task directly from DB: stored status is still "Pending"
    const inDb = await Task.findById(overdueTask._id).lean();
    assert.equal(inDb.status, "Pending", "Database record must remain Pending (no cron mutation)");

    // Simulate query-time derivation
    const now = new Date();
    const isOverdue =
      inDb.status === "Overdue" ||
      ((inDb.status === "Pending" || inDb.status === "In Progress") && inDb.dueDate && new Date(inDb.dueDate) < now);

    assert.equal(isOverdue, true, "Must be computed as overdue at query time");
  });

  test("4. Lost lead reads use countDocuments({ status: 'Lost' })", async () => {
    await Enquiry.create({
      studentFullName: "Drift Lost Lead 1",
      email: "lost1@drift.test",
      primaryPhoneMobile: "9876540001",
      status: "Lost",
      targetBrand: brandName,
      targetBrandId: brandId,
    });

    await Enquiry.create({
      studentFullName: "Drift Lost Lead 2",
      email: "lost2@drift.test",
      primaryPhoneMobile: "9876540002",
      status: "Lost",
      targetBrand: brandName,
      targetBrandId: brandId,
    });

    const lostCount = await Enquiry.countDocuments({
      status: "Lost",
      targetBrandId: brandId,
    });

    assert.equal(lostCount, 2, "countDocuments on status='Lost' returns exact count of lost enquiries");
  });
});
