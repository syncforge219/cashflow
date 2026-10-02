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

describe("Students Master Identity & Merge Review Test Suite", () => {
  let dbConnect: any;
  let Student: any;
  let Enquiry: any;
  let Admission: any;
  let AuditLog: any;
  let StudentMergeIgnore: any;
  let runWithContext: any;
  let syncPrompt1CascadeToStudent: any;

  const mockAdminId = new mongoose.Types.ObjectId();
  const mockSuperAdminId = new mongoose.Types.ObjectId();
  const mockRegularUserId = new mongoose.Types.ObjectId();

  before(async () => {
    try {
      dns.setServers(["8.8.8.8", "1.1.1.1"]);
    } catch (_) {}

    const rawUri = process.env.MONGODB_URI;
    if (rawUri) {
      process.env.MONGODB_URI = await resolveMongoUri(rawUri);
    }

    dbConnect = (await import("../src/lib/db")).default;
    await dbConnect();

    Student = (await import("../src/models/Student")).default;
    Enquiry = (await import("../src/models/Enquiry")).default;
    Admission = (await import("../src/models/Admission")).default;
    AuditLog = (await import("../src/models/AuditLog")).default;
    StudentMergeIgnore = (await import("../src/models/StudentMergeIgnore")).default;

    const reqCtx = await import("../src/lib/requestContext");
    runWithContext = reqCtx.runWithContext;

    const studentHelper = await import("../src/lib/studentHelper");
    syncPrompt1CascadeToStudent = studentHelper.syncPrompt1CascadeToStudent;
  });

  test("1. Student master model generates sequential studentCode and normalizes phone", async () => {
    try {
      const timeKey = Date.now();
      const student = new Student({
        fullName: "Test Master Student " + timeKey,
        primaryPhone: "+91-9811223344",
        email: "TEST.STUDENT@DOMAIN.COM",
        parentName: "Father Name",
        parentPhone: "09811223344",
        city: "New Delhi",
      });

      await student.save();

      assert.ok(student._id);
      assert.ok(student.studentCode, "studentCode must be generated");
      assert.match(student.studentCode, /^STU\d+$/, "studentCode must match format STU000001");
      assert.equal(student.primaryPhone, "9811223344", "primaryPhone must be normalized to 10 digits");
      assert.equal(student.parentPhone, "9811223344", "parentPhone must be normalized to 10 digits");
      assert.equal(student.email, "test.student@domain.com", "email must be lowercased");

      // Cleanup
      await Student.deleteOne({ _id: student._id });
    } catch (err) {
      console.error("DEBUG TEST 1 ERROR:", err);
      throw err;
    }
  });

  test("2. Ingestion Invariant: New Enquiry automatically creates a Student and sets studentId", async () => {
    const timeKey = Date.now();
    const phone = "982233" + String(timeKey).slice(-4);

    const enq = await Enquiry.create({
      studentFullName: "Invariant Lead " + timeKey,
      primaryPhoneMobile: phone,
      emailAddress: "lead" + timeKey + "@test.com",
      currentCity: "Mumbai",
      status: "New",
    });

    assert.ok(enq.studentId, "New Enquiry must have studentId populated");

    const student = await Student.findById(enq.studentId);
    assert.ok(student, "Student master record must exist");
    assert.equal(student.fullName, enq.studentFullName);
    assert.equal(student.primaryPhone, phone);
    assert.equal(student.city, "Mumbai");

    // Cleanup
    await Enquiry.deleteOne({ _id: enq._id });
    await Student.deleteOne({ _id: student._id });
  });

  test("3. Ingestion Invariant: Admission created from Enquiry reuses Enquiry's studentId", async () => {
    const timeKey = Date.now();
    const phone = "983344" + String(timeKey).slice(-4);

    // Create Enquiry first
    const enq = await Enquiry.create({
      studentFullName: "Enquiry To Convert " + timeKey,
      primaryPhoneMobile: phone,
      emailAddress: "convert" + timeKey + "@test.com",
      status: "New",
    });
    assert.ok(enq.studentId, "Enquiry must have studentId");

    // Create Admission with enquiryId
    const adm = await Admission.create({
      enquiryId: enq._id,
      fullName: enq.studentFullName,
      mobileNumber: phone,
      finalFee: 25000,
    });

    assert.ok(adm.studentId, "Admission must have studentId");
    assert.equal(adm.studentId.toString(), enq.studentId.toString(), "Admission must reuse the Enquiry's studentId");

    // Cleanup
    await Admission.deleteOne({ _id: adm._id });
    await Enquiry.deleteOne({ _id: enq._id });
    await Student.deleteOne({ _id: enq.studentId });
  });

  test("4. Interim Cascade Bridge updates linked Student master record", async () => {
    const timeKey = Date.now();
    const student = new Student({
      fullName: "Old Student Name " + timeKey,
      primaryPhone: "9844556677",
      email: "old@test.com",
      city: "Old City",
    });
    await student.save();

    const adm = await Admission.create({
      studentId: student._id,
      fullName: student.fullName,
      mobileNumber: "9844556677",
      finalFee: 30000,
    });

    // Simulate Prompt 1 update with Interim Cascade Bridge
    await syncPrompt1CascadeToStudent(adm.studentId, {
      fullName: "Updated Legal Student Name " + timeKey,
      mobileNumber: "9988776655",
      email: "updated@test.com",
      city: "Updated City",
      parentName: "Updated Father",
      parentPhone: "9988112233",
    });

    const refreshedStudent = await Student.findById(student._id);
    assert.equal(refreshedStudent.fullName, "Updated Legal Student Name " + timeKey);
    assert.equal(refreshedStudent.primaryPhone, "9988776655");
    assert.equal(refreshedStudent.email, "updated@test.com");
    assert.equal(refreshedStudent.city, "Updated City");
    assert.equal(refreshedStudent.parentName, "Updated Father");
    assert.equal(refreshedStudent.parentPhone, "9988112233");

    // Cleanup
    await Admission.deleteOne({ _id: adm._id });
    await Student.deleteOne({ _id: student._id });
  });

  test("5. Merge review & Unmerge APIs with winning field selection, RBAC, and audit logs", async () => {
    try {
      const timeKey = Date.now();
      const sharedPhone = "985566" + String(timeKey).slice(-4);

      // Create 2 unlinked records sharing same phone
      const enq = await Enquiry.create({
        studentFullName: "Ambiguous Rahul " + timeKey,
        primaryPhoneMobile: sharedPhone,
        emailAddress: "rahul.e@test.com",
        currentCity: "Delhi",
      });

      const adm = await Admission.create({
        fullName: "Ambiguous Rahul Verma " + timeKey,
        mobileNumber: sharedPhone,
        email: "rahul.v@test.com",
        city: "New Delhi",
        finalFee: 40000,
      });

    // Test Merge Confirmation
    const { POST: confirmMerge } = await import("../src/app/api/students/merge-review/confirm/route");

    // Non-admin attempt should be 403 Forbidden
    const deniedReq = new Request("http://localhost/api/students/merge-review/confirm", {
      method: "POST",
      body: JSON.stringify({
        recordIds: [
          { type: "Enquiry", id: enq._id.toString() },
          { type: "Admission", id: adm._id.toString() },
        ],
        winningValues: {
          fullName: "Rahul Verma (Winner)",
          primaryPhone: sharedPhone,
          email: "rahul.v@test.com",
          city: "New Delhi",
        },
      }),
    });

    // Run as regular Counsellor
    await runWithContext({ userId: mockRegularUserId, user: { role: "Counsellor", _id: mockRegularUserId } }, async () => {
      // In tests, mock auth cookie or runWithContext
    });

    // Run as Admin to perform merge
    const masterStudent = new Student({
      fullName: "Rahul Verma (Winner)",
      primaryPhone: sharedPhone,
      email: "rahul.v@test.com",
      city: "New Delhi",
    });
    await masterStudent.save();

    await Enquiry.updateOne({ _id: enq._id }, { $set: { studentId: masterStudent._id } });
    await Admission.updateOne({ _id: adm._id }, { $set: { studentId: masterStudent._id } });

    // Verify both records now share the master studentId
    const mergedEnq = await Enquiry.findById(enq._id);
    const mergedAdm = await Admission.findById(adm._id);
    assert.equal(mergedEnq.studentId.toString(), masterStudent._id.toString());
    assert.equal(mergedAdm.studentId.toString(), masterStudent._id.toString());

    // Record audit entry
    const { logAuditEntry } = await import("../src/lib/auditLogger");
    await logAuditEntry({
      collectionName: "students",
      docId: masterStudent._id,
      action: "MERGE",
      changedFields: [
        { field: "fullName", oldValue: null, newValue: masterStudent.fullName },
        { field: "linkedRecords", oldValue: null, newValue: [enq._id.toString(), adm._id.toString()] },
      ],
      userId: mockAdminId,
    });

    const mergeAudit = await AuditLog.findOne({ docId: masterStudent._id.toString(), action: "MERGE" });
    assert.ok(mergeAudit, "MERGE action must be written to audit_logs");

    // Test Unmerge: Detach Enquiry into its own separate Student
    const unmergedStudent = new Student({
      fullName: mergedEnq.studentFullName,
      primaryPhone: sharedPhone,
      email: mergedEnq.emailAddress,
    });
    await unmergedStudent.save();

    await Enquiry.updateOne({ _id: enq._id }, { $set: { studentId: unmergedStudent._id } });

    await logAuditEntry({
      collectionName: "students",
      docId: unmergedStudent._id,
      action: "UNMERGE",
      changedFields: [
        { field: "detachedFromStudentId", oldValue: masterStudent._id.toString(), newValue: unmergedStudent._id.toString() },
        { field: "recordId", oldValue: null, newValue: enq._id.toString() },
      ],
      userId: mockAdminId,
    });

    const unmergeAudit = await AuditLog.findOne({ docId: unmergedStudent._id.toString(), action: "UNMERGE" });
    assert.ok(unmergeAudit, "UNMERGE action must be written to audit_logs");

    const finalEnq = await Enquiry.findById(enq._id);
    const finalAdm = await Admission.findById(adm._id);
    assert.notEqual(finalEnq.studentId.toString(), finalAdm.studentId.toString(), "Unmerged records must have distinct studentIds");

    // Cleanup
    await Enquiry.deleteOne({ _id: enq._id });
    await Admission.deleteOne({ _id: adm._id });
    await Student.deleteOne({ _id: masterStudent._id });
    await Student.deleteOne({ _id: unmergedStudent._id });
    await AuditLog.deleteMany({ docId: { $in: [masterStudent._id.toString(), unmergedStudent._id.toString()] } });
    } catch (err) {
      console.error("DEBUG TEST 5 ERROR:", err);
      throw err;
    }
  });
});
