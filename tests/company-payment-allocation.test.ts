import { test, describe, before, after, mock } from "node:test";
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
process.env.FIELD_ENCRYPTION_KEY = "e".repeat(64);

globalThis.fetch = (async () => {
  throw new Error("network disabled in tests");
}) as any;

let currentUser: any = { _id: new mongoose.Types.ObjectId(), name: "Test Admin", role: "Super Admin" };
mock.module(pathToFileURL(path.resolve(process.cwd(), "src/lib/helper.ts")).href, {
  namedExports: {
    getUserFromCookies: async () => currentUser,
    canDeleteFinancialRecords: () => true,
    escapeRegex: (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  },
});

describe("Fee Collection: Company Allocation Isolation", () => {
  let mongod: MongoMemoryServer;
  let Admission: any;
  let Payment: any;
  let Company: any;
  let Brand: any;
  let paymentPostRoute: any;
  let compA: any;
  let compB: any;
  let brandDoc: any;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("company_allocation_test");
    await mongoose.connect(process.env.MONGODB_URI);

    Admission = (await import("../src/models/Admission")).default;
    Payment = (await import("../src/models/Payment")).default;
    Company = (await import("../src/models/Company")).default;
    Brand = (await import("../src/models/Brand")).default;

    const paymentsModule = await import("../src/app/api/payments/route");
    paymentPostRoute = paymentsModule.POST;

    compA = await Company.create({
      name: "SLING SHOT TECHNOLOGIES",
      legalName: "Sling Shot Technologies Pvt Ltd",
      brand: "TECH BRAND",
      brands: ["TECH BRAND"],
      status: "ACTIVE",
      annualCapacityCap: 2000000,
      collectedRevenue: 10000,
      currentFinancialYear: "2026-27"
    });

    compB = await Company.create({
      name: "TECH INNOVATIONS",
      legalName: "Tech Innovations LLP",
      brand: "TECH BRAND",
      brands: ["TECH BRAND"],
      status: "ACTIVE",
      annualCapacityCap: 2000000,
      collectedRevenue: 0,
      currentFinancialYear: "2026-27"
    });

    brandDoc = await Brand.create({
      name: "TECH BRAND",
      code: "TB",
      companies: ["SLING SHOT TECHNOLOGIES", "TECH INNOVATIONS"]
    });
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("1. When user selects Company B on Fee Collection, payment goes to Company B only and NOT Company A", async () => {
    // Create admission originally assigned to Company A (like in user screenshot)
    const student = await Admission.create({
      admissionId: "ADM-2026-001",
      fullName: "Rohan Sharma",
      mobileNumber: "9876543210",
      email: "rohan@example.com",
      course: "Full Stack Development",
      brand: "TECH BRAND",
      companyAssigned: "SLING SHOT TECHNOLOGIES",
      companyId: compA._id,
      finalFee: 10000,
      remainingBalance: 5000,
      amountReceivedToday: 5000,
    });

    // Initial non-cash payment under Company A was already made
    await Payment.create({
      receiptNo: "REC-1001",
      admissionId: student._id,
      studentName: student.fullName,
      amountReceived: 5000,
      paymentMode: "UPI",
      company: "SLING SHOT TECHNOLOGIES",
      companyId: compA._id,
      brand: "TECH BRAND",
      particulars: { courseFeeDue: 5000 }
    });

    // User collects remaining fee (2nd installment ₹4,999) and selects "TECH INNOVATIONS" in dropdown
    const reqBody = {
      admissionId: student._id.toString(),
      amountReceived: 4999,
      paymentDate: "2026-10-07",
      paymentMode: "UPI",
      referenceNo: "Ref-2026-27193",
      company: "TECH INNOVATIONS",
      particulars: { courseFeeDue: 4999 }
    };

    const req = new Request("http://localhost/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqBody)
    });

    const response = await paymentPostRoute(req);
    const json = await response.json();

    assert.equal(response.status, 201, "Expected 201 Created");
    assert.equal(json.success, true);
    assert.equal(json.data.company, "TECH INNOVATIONS", "Payment must be assigned to selected Company B");
    assert.equal(String(json.data.companyId), String(compB._id), "Payment companyId must match Company B ObjectId");
    assert.equal(json.data.amountReceived, 4999);

    // Verify database Payment record
    const createdPayment = await Payment.findById(json.data._id);
    assert.ok(createdPayment);
    assert.equal(createdPayment.company, "TECH INNOVATIONS");
    assert.equal(String(createdPayment.companyId), String(compB._id));

    // Verify student record updated to Company B
    const updatedStudent = await Admission.findById(student._id);
    assert.equal(updatedStudent.companyAssigned, "TECH INNOVATIONS");
    assert.equal(String(updatedStudent.companyId), String(compB._id));

    // Verify Company B received blocked revenue / capacity
    const updatedCompB = await Company.findById(compB._id);
    assert.ok(updatedCompB.collectedRevenue >= 4999, "Company B must receive revenue");

    // Verify Company A did NOT receive this payment
    const paymentsForCompA = await Payment.find({
      admissionId: student._id,
      company: "SLING SHOT TECHNOLOGIES"
    });
    assert.equal(paymentsForCompA.length, 1, "Company A should only have the original 1 payment, not this new one");
  });

  test("2. When payment mode is Cash, company is Cash (Unallocated)", async () => {
    const student = await Admission.create({
      admissionId: "ADM-2026-002",
      fullName: "Ananya Patel",
      mobileNumber: "9876543211",
      course: "Data Science",
      brand: "TECH BRAND",
      companyAssigned: "SLING SHOT TECHNOLOGIES",
      companyId: compA._id,
      finalFee: 15000,
      remainingBalance: 15000,
    });

    const reqBody = {
      admissionId: student._id.toString(),
      amountReceived: 5000,
      paymentDate: "2026-10-07",
      paymentMode: "Cash",
      referenceNo: "Ref-Cash-001",
      company: "Cash",
      particulars: { courseFeeDue: 5000 }
    };

    const req = new Request("http://localhost/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reqBody)
    });

    const response = await paymentPostRoute(req);
    const json = await response.json();

    assert.equal(response.status, 201);
    assert.equal(json.data.company, "Cash");
    assert.equal(json.data.companyId, null);
  });
});
