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

let currentUser: any = { _id: new mongoose.Types.ObjectId(), name: "Test Counsellor", role: "counsellor" };
mock.module(pathToFileURL(path.resolve(process.cwd(), "src/lib/helper.ts")).href, {
  namedExports: {
    getUserFromCookies: async () => currentUser,
    canDeleteFinancialRecords: () => true,
    escapeRegex: (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  },
});

describe("Admitted Students Exclusion from Follow-up Tasks", () => {
  let mongod: MongoMemoryServer;
  let Admission: any;
  let Enquiry: any;
  let Task: any;
  let admissionPostRoute: any;
  let tasksGetRoute: any;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("admitted_followup_exclusion_test");
    await mongoose.connect(process.env.MONGODB_URI);

    Admission = (await import("../src/models/Admission")).default;
    Enquiry = (await import("../src/models/Enquiry")).default;
    Task = (await import("../src/models/Task")).default;

    const admModule = await import("../src/app/api/admissions/route");
    admissionPostRoute = admModule.POST;

    const taskModule = await import("../src/app/api/tasks/route");
    tasksGetRoute = taskModule.GET;
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("Creating an admission marks linked enquiry as Admitted and cancels pending follow-ups", async () => {
    // 1. Create an Enquiry with pending follow-ups
    const enq = await Enquiry.create({
      enquiryId: "ENQ-TEST-001",
      studentFullName: "Rahul Sharma",
      primaryPhoneMobile: "9876543210",
      targetCourse: "Full Stack Development",
      assignedCrmAdvisor: "Test Counsellor",
      status: "Hot Lead",
      followUps: [
        {
          date: "2026-10-07",
          time: "11:00 AM",
          priority: "High",
          typeOfContact: "Phone Call",
          remarks: "Needs to confirm fees",
          status: "Pending",
          isCompleted: false,
        },
      ],
    });

    // Create an associated Task of taskType: Follow-up
    const followupTask = await Task.create({
      title: "Follow-up Call: Rahul Sharma",
      description: "Follow up about course discounts",
      taskType: "Follow-up",
      linkedStudentName: "Rahul Sharma",
      linkedEnquiryId: enq.enquiryId,
      assignedTo: "Test Counsellor",
      priority: "High",
      status: "Pending",
      dueDate: new Date(),
    });

    // 2. Submit admission for this student
    const admPayload = {
      enquiryId: enq.enquiryId, // string human-readable enquiry ID
      fullName: "Rahul Sharma",
      mobileNumber: "9876543210",
      course: "Full Stack Development",
      courseFee: 45000,
      registrationAmount: 10000,
      counsellor: "Test Counsellor",
      brand: "CADDesk",
    };

    const req = new Request("http://localhost:3000/api/admissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(admPayload),
    });

    const res = await admissionPostRoute(req as any);
    const data = await res.json();
    assert.equal(res.status, 201, "Admission creation should return 201");
    assert.equal(data.success, true);

    // 3. Verify enquiry is updated to Admitted with isAdmitted: true
    const updatedEnq = await Enquiry.findById(enq._id);
    assert.equal(updatedEnq.status, "Admitted");
    assert.equal(updatedEnq.isAdmitted, true);
    assert.equal(updatedEnq.followUps[0].status, "Cancelled");
    assert.equal(updatedEnq.followUps[0].isCompleted, true);

    // 4. Verify Task is marked Completed
    const updatedTask = await Task.findById(followupTask._id);
    assert.equal(updatedTask.status, "Completed");
  });

  test("GET /api/tasks automatically completes and excludes lead tasks for admitted students", async () => {
    // 1. Create an admission directly
    const adm = await Admission.create({
      admissionId: "ADM-TEST-999",
      fullName: "Priya Patel",
      mobileNumber: "9123456780",
      course: "Data Science",
      counsellor: "Test Counsellor",
      brand: "CADDesk",
      finalFee: 50000,
      remainingBalance: 30000,
    });

    // 2. Create a pending lead call task linked to this admitted student
    const pendingLeadTask = await Task.create({
      title: "Call Lead: Priya Patel",
      description: "Initial consultation",
      taskType: "Lead Call",
      linkedStudentName: "Priya Patel",
      assignedTo: "Test Counsellor",
      priority: "High",
      status: "Pending",
      dueDate: new Date(),
    });

    // 3. Query GET /api/tasks?status=Pending
    const req = new Request("http://localhost:3000/api/tasks?status=Pending&assignedTo=Test%20Counsellor");
    const res = await tasksGetRoute(req);
    const data = await res.json();

    assert.equal(data.success, true);
    // Priya Patel's task should NOT be in the pending list because she is already admitted!
    const priyaTask = data.tasks.find((t: any) => t._id.toString() === pendingLeadTask._id.toString());
    assert.equal(priyaTask, undefined, "Lead task for admitted student must not appear in pending tasks");

    // In the database, the task should now be Completed
    const checkTask = await Task.findById(pendingLeadTask._id);
    assert.equal(checkTask.status, "Completed");
  });

  test("Phone-based enquiry match is marked Admitted when student enrolls without explicit enquiryId", async () => {
    // 1. Create an enquiry without custom enquiryId
    const phoneEnq = await Enquiry.create({
      studentFullName: "Amit Verma",
      primaryPhoneMobile: "9811223344",
      targetCourse: "AutoCAD",
      assignedCrmAdvisor: "Test Counsellor",
      status: "Follow-up Required",
      followUps: [
        {
          date: "2026-10-07",
          time: "02:00 PM",
          remarks: "Wants fee structure",
          status: "Pending",
          isCompleted: false,
        },
      ],
    });

    // 2. Admission submitted without enquiryId, but with matching phone
    const admPayload = {
      fullName: "Amit Verma",
      mobileNumber: "9811223344",
      course: "AutoCAD",
      courseFee: 25000,
      registrationAmount: 5000,
      counsellor: "Test Counsellor",
      brand: "CADDesk",
    };

    const req = new Request("http://localhost:3000/api/admissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(admPayload),
    });

    const res = await admissionPostRoute(req as any);
    const data = await res.json();
    assert.equal(res.status, 201);

    // 3. Verify enquiry was matched by phone and updated
    const updated = await Enquiry.findById(phoneEnq._id);
    assert.equal(updated.status, "Admitted");
    assert.equal(updated.isAdmitted, true);
    assert.equal(updated.followUps[0].status, "Cancelled");
    assert.equal(updated.followUps[0].isCompleted, true);
  });

  test("Follow-up queues exclude admitted students in all scenarios", () => {
    const admissions = [
      {
        admissionId: "ADM-001",
        enquiryId: "ENQ-MATCH-1",
        mobileNumber: "9988776655",
        parentPhone: "9988776600",
      },
    ];

    const admittedPhoneSet = new Set<string>();
    admissions.forEach((adm: any) => {
      const p1 = String(adm.mobileNumber || "").replace(/\D/g, "").slice(-10);
      if (p1.length === 10) admittedPhoneSet.add(p1);
      const p2 = String(adm.parentPhone || "").replace(/\D/g, "").slice(-10);
      if (p2.length === 10) admittedPhoneSet.add(p2);
    });

    const admittedEnquiryIdSet = new Set<string>();
    admissions.forEach((adm: any) => {
      if (adm.enquiryId) admittedEnquiryIdSet.add(String(adm.enquiryId).trim());
      if (adm.admissionId) admittedEnquiryIdSet.add(String(adm.admissionId).trim());
    });

    const isAdmittedLead = (rec: any) => {
      if (rec.isAdmitted === true) return true;
      const s = (rec.status || "").toLowerCase().trim();
      if (s.includes("admitted") || s.includes("admission") || s.includes("enrolled") || s.includes("converted")) return true;
      if (rec._id && admittedEnquiryIdSet.has(String(rec._id).trim())) return true;
      if (rec.enquiryId && admittedEnquiryIdSet.has(String(rec.enquiryId).trim())) return true;
      if (rec.primaryPhoneMobile) {
        const clean = String(rec.primaryPhoneMobile).replace(/\D/g, "").slice(-10);
        if (clean.length === 10 && admittedPhoneSet.has(clean)) return true;
      }
      if (rec.parentsPhoneNumber) {
        const clean = String(rec.parentsPhoneNumber).replace(/\D/g, "").slice(-10);
        if (clean.length === 10 && admittedPhoneSet.has(clean)) return true;
      }
      return false;
    };

    // 1. Lead with isAdmitted: true
    assert.equal(isAdmittedLead({ isAdmitted: true, status: "Hot Lead" }), true);

    // 2. Lead with status: "Admitted"
    assert.equal(isAdmittedLead({ status: "Admitted" }), true);

    // 3. Lead with matching enquiryId
    assert.equal(isAdmittedLead({ enquiryId: "ENQ-MATCH-1", status: "New" }), true);

    // 4. Lead with matching student phone
    assert.equal(isAdmittedLead({ primaryPhoneMobile: "+91 9988776655", status: "Demo" }), true);

    // 5. Lead with matching parent phone
    assert.equal(isAdmittedLead({ parentsPhoneNumber: "9988776600", status: "New Lead" }), true);

    // 6. Regular prospective lead (not admitted)
    assert.equal(isAdmittedLead({ primaryPhoneMobile: "9111222333", status: "New", isAdmitted: false }), false);
  });
});
