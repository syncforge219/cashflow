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

describe("Batch, Task, and Course Standardization Test Suite", () => {
  let Admission: any;
  let Batch: any;
  let Task: any;
  let Enquiry: any;
  let Company: any;
  let Brand: any;
  let User: any;
  let syncAdmissionRefs: any;
  let syncEnquiryRefs: any;

  let companyId: Types.ObjectId;
  let brandId: Types.ObjectId;
  let counsellorId: Types.ObjectId;
  let testBatchId: Types.ObjectId;
  let brandName: string;
  let companyName: string;
  let counsellorName: string;
  let batchName: string;

  before(async () => {
    const rawUri = process.env.MONGODB_URI;
    if (!rawUri) {
      throw new Error("MONGODB_URI is not set in environment or .env file");
    }
    const resolvedUri = await resolveMongoUri(rawUri);
    await mongoose.connect(resolvedUri);

    ({ default: Admission } = await import("../src/models/Admission"));
    ({ default: Batch } = await import("../src/models/Batch"));
    ({ default: Task } = await import("../src/models/Task"));
    ({ default: Enquiry } = await import("../src/models/Enquiry"));
    ({ default: Company } = await import("../src/models/Company"));
    ({ default: Brand } = await import("../src/models/Brand"));
    ({ default: User } = await import("../src/models/User"));
    ({ syncAdmissionRefs, syncEnquiryRefs } = await import("../src/lib/referenceHelper"));

    const timestamp = Date.now();
    brandName = `Batch Test Brand ${timestamp}`;
    companyName = `Batch Test Corp ${timestamp}`;
    counsellorName = `Counsellor Batch Test ${timestamp}`;
    batchName = `Fullstack-Alpha-${timestamp}`;

    const br = await Brand.create({
      name: brandName,
      code: `BT${timestamp.toString().slice(-4)}`,
      brandType: "Corporate",
      isActive: true,
    });
    brandId = br._id;

    const comp = await Company.create({
      name: companyName,
      legalName: `${companyName} Pvt Ltd`,
      gstin: `07AABCT${timestamp.toString().slice(-4)}A1Z5`,
      annualThreshold: 2000000,
      monthlyThreshold: 200000,
      brands: [brandName],
      brand: brandName,
      isActive: true,
    });
    companyId = comp._id;

    const u = await User.create({
      name: counsellorName,
      email: `counsellor.batch.${timestamp}@test.local`,
      password: "hashedpassword123",
      role: "counsellor",
      brandScope: brandName,
      isActive: true
    });
    counsellorId = u._id;

    const b = await Batch.create({
      batchName: batchName,
      courseName: "Fullstack Web Development",
      course: "Fullstack Web Development",
      timing: "10:00 AM - 12:00 PM",
      teacherName: counsellorName,
      teacherId: counsellorId,
      startDate: new Date(),
      status: "Active",
      capacity: 30,
      brand: brandName,
      brandId: brandId,
      companyId: companyId,
      students: [] // Legacy field left empty
    });
    testBatchId = b._id;
  });

  after(async () => {
    await Admission.deleteMany({ email: /@batchtest\.local$/ });
    await Enquiry.deleteMany({ email: /@batchtest\.local$/ });
    await Task.deleteMany({ title: /Batch Test/ });
    await Batch.deleteMany({ _id: testBatchId });
    await Brand.deleteMany({ _id: brandId });
    await Company.deleteMany({ _id: companyId });
    await User.deleteMany({ _id: counsellorId });
    await mongoose.disconnect();
  });

  test("1. Admission.batchId is ObjectId ref Batch & syncAdmissionRefs resolves batchId", async () => {
    const admissionData: any = {
      fullName: "Student One",
      email: "student1@batchtest.local",
      phoneNumber: "9876500001",
      course: "Fullstack Web Development",
      totalFees: 50000,
      batchAssigned: batchName,
      brand: brandName,
      counsellor: counsellorName,
      companyAssigned: companyName
    };

    await syncAdmissionRefs(admissionData);

    assert.ok(admissionData.batchId, "batchId should be resolved from batchAssigned string");
    assert.equal(admissionData.batchId.toString(), testBatchId.toString());

    const createdAdm = await Admission.create(admissionData);
    assert.ok(createdAdm._id);
    assert.equal(createdAdm.batchId?.toString(), testBatchId.toString());

    // Batch.students should NOT be written to or mutated
    const batchInDb = await Batch.findById(testBatchId);
    assert.equal(batchInDb?.students?.length, 0, "Batch.students must not be appended to by admission writes");

    // Dynamic query verification: admissions for batch
    const enrolledAdmissions = await Admission.find({
      $or: [{ batchId: testBatchId }, { batchAssigned: batchName }]
    });
    assert.equal(enrolledAdmissions.length, 1);
    assert.equal(enrolledAdmissions[0].fullName, "Student One");
  });

  test("2. Task.linkedType enum and automatic inference", async () => {
    // A: Inferred from linkedEnquiryId prefix / presence
    const taskEnq = await Task.create({
      title: "Batch Test: Follow-up Call",
      assignedTo: "Counsellor Batch Test",
      dueDate: new Date(),
      taskType: "Lead Call",
      linkedEnquiryId: "ENQ-2026-9999"
    });
    assert.equal(taskEnq.linkedType, "Enquiry", "Should infer Enquiry from linkedEnquiryId");

    // B: Inferred from linkedStudentId ADM prefix
    const taskAdm = await Task.create({
      title: "Batch Test: Send LMS Onboarding",
      assignedTo: "Counsellor Batch Test",
      dueDate: new Date(),
      taskType: "Welcome Onboarding",
      linkedStudentId: "ADM-2026-001"
    });
    assert.equal(taskAdm.linkedType, "Admission", "Should infer Admission from ADM prefix");

    // C: Inferred from SOP taskType
    const taskSop = await Task.create({
      title: "Batch Test: Fee Follow-up",
      assignedTo: "Counsellor Batch Test",
      dueDate: new Date(),
      taskType: "Fee Collection",
      linkedStudentId: "6a632865a95e567b0050d400"
    });
    assert.equal(taskSop.linkedType, "Admission", "Should infer Admission from SOP taskType");

    // D: Explicit linkedType takes precedence
    const taskExplicit = await Task.create({
      title: "Batch Test: Custom Task",
      assignedTo: "Counsellor Batch Test",
      dueDate: new Date(),
      taskType: "General",
      linkedType: "Enquiry"
    });
    assert.equal(taskExplicit.linkedType, "Enquiry");
  });

  test("3. Course vs Courses standardization with dual-read fallback", async () => {
    // Enquiry normalization
    const enqData: any = {
      studentFullName: "Course Test Student",
      email: "coursetest@batchtest.local",
      primaryPhoneMobile: "9876500002",
      course: "UI/UX Design",
      assignedCrmAdvisor: counsellorName,
      targetBrand: brandName
    };
    await syncEnquiryRefs(enqData);

    assert.deepEqual(enqData.courses, ["UI/UX Design"], "courses array should be standardized from course string");
    assert.equal(enqData.course, "UI/UX Design");

    const createdEnq = await Enquiry.create(enqData);
    assert.ok(Array.isArray(createdEnq.courses));
    assert.equal(createdEnq.courses[0], "UI/UX Design");
    assert.equal(createdEnq.course, "UI/UX Design");

    // Admission normalization
    const admData: any = {
      fullName: "Course Test Admission",
      email: "admcourse@batchtest.local",
      phoneNumber: "9876500003",
      courses: ["Data Science", "Python"],
      totalFees: 60000,
      brand: brandName,
      counsellor: counsellorName,
      companyAssigned: companyName
    };
    await syncAdmissionRefs(admData);

    assert.equal(admData.course, "Data Science, Python", "course string should be populated from courses array");
    assert.deepEqual(admData.courses, ["Data Science", "Python"]);

    const createdAdm = await Admission.create(admData);
    assert.equal(createdAdm.course, "Data Science, Python");
    assert.deepEqual(createdAdm.courses, ["Data Science", "Python"]);
  });

  test("4. Admission with empty string batchId or General Batch casts cleanly to null and saves without error", async () => {
    // A: Directly creating admission with batchId: ""
    const admDataEmptyBatchId: any = {
      fullName: "General Batch Student",
      email: "generalbatch@batchtest.local",
      mobileNumber: "9876500004",
      batch: "General Batch",
      batchId: "",
      brandId: brandId,
      companyId: companyId,
      counsellorId: counsellorId,
      course: "AutoCAD",
      courseFee: 18000,
      finalFee: 18000,
      remainingBalance: 17000,
    };

    const doc = await Admission.create(admDataEmptyBatchId);
    assert.ok(doc._id);
    assert.equal(doc.batchId, null, "batchId should be null instead of empty string");

    // B: Loading document into memory and simulating payment save
    doc.remainingBalance = 0;
    doc.amountReceivedToday = 18000;
    await doc.save();
    assert.equal(doc.remainingBalance, 0);

    // C: Simulating MongoDB raw document containing batchId: "" via raw collection write
    const rawId = new Types.ObjectId();
    await mongoose.connection.db!.collection("admissions").insertOne({
      _id: rawId,
      fullName: "Legacy Raw Student",
      email: "legacyraw@batchtest.local",
      mobileNumber: "9876500005",
      batch: "General Batch",
      batchId: "",
      brandId: brandId,
      companyId: companyId,
      counsellorId: counsellorId,
      course: "AutoCAD",
      courseFee: 18000,
      finalFee: 18000,
      remainingBalance: 17000,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Load via Mongoose Admission model (simulating /api/payments Admission.findOne)
    const loadedDoc = await Admission.findById(rawId);
    assert.ok(loadedDoc);
    assert.equal(loadedDoc.batchId, null, "Mongoose custom cast must convert legacy '' from DB to null");
    assert.equal(loadedDoc.errors, undefined, "Mongoose init must not register a CastError");

    // Now call save (simulating /api/payments admission.save)
    loadedDoc.remainingBalance = 0;
    loadedDoc.amountReceivedToday = 18000;
    await loadedDoc.save();
    assert.equal(loadedDoc.remainingBalance, 0);
  });
});
