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

let currentUser: any = {
  _id: new mongoose.Types.ObjectId(),
  name: "Branch Centre Head",
  role: "Centre Head",
  brandScope: "CAD Desk",
};

mock.module(pathToFileURL(path.resolve(process.cwd(), "src/lib/helper.ts")).href, {
  namedExports: {
    getUserFromCookies: async () => currentUser,
    canDeleteFinancialRecords: () => true,
    escapeRegex: (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  },
});

describe("Course-Wise Follow-up Lead Transfer API", () => {
  let mongod: MongoMemoryServer;
  let Enquiry: any;
  let Task: any;
  let User: any;
  let transferPostRoute: any;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("enquiry_course_wise_transfer_test");
    await mongoose.connect(process.env.MONGODB_URI);

    Enquiry = (await import("../src/models/Enquiry")).default;
    Task = (await import("../src/models/Task")).default;
    User = (await import("../src/models/User")).default;

    const transferModule = await import("../src/app/api/enquiries/transfer/route");
    transferPostRoute = transferModule.POST;
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("transfers only leads belonging to the specified course to the target counsellor", async () => {
    const targetUser = await User.create({
      name: "Sneha Sharma",
      email: "sneha@caddesk.com",
      role: "counsellor",
      brandScope: "CAD Desk",
      password: "password123",
    });

    const enqAutoCad1 = await Enquiry.create({
      enquiryId: "ENQ001",
      studentFullName: "Rohan Verma",
      primaryPhoneMobile: "9876543210",
      targetCourse: "AutoCAD 2D/3D",
      targetBrand: "CAD Desk",
      assignedCrmAdvisor: "Rahul Mehta",
      status: "Pending",
      followUps: [{ date: "2026-10-20", assignedTo: "Rahul Mehta", status: "Pending" }],
    });

    const enqAutoCad2 = await Enquiry.create({
      enquiryId: "ENQ002",
      studentFullName: "Priya Nair",
      primaryPhoneMobile: "9876543211",
      targetCourse: "AutoCAD Electrical",
      targetBrand: "CAD Desk",
      assignedCrmAdvisor: "Rahul Mehta",
      status: "Pending",
      followUps: [{ date: "2026-10-21", assignedTo: "Rahul Mehta", status: "Pending" }],
    });

    const enqRevit = await Enquiry.create({
      enquiryId: "ENQ003",
      studentFullName: "Ankit Singh",
      primaryPhoneMobile: "9876543212",
      targetCourse: "Revit Architecture",
      targetBrand: "CAD Desk",
      assignedCrmAdvisor: "Rahul Mehta",
      status: "Pending",
      followUps: [{ date: "2026-10-22", assignedTo: "Rahul Mehta", status: "Pending" }],
    });

    await Task.create({
      title: "Follow-up with Rohan",
      linkedEnquiryId: enqAutoCad1._id.toString(),
      assignedTo: "Rahul Mehta",
      dueDate: new Date(),
      status: "Pending",
    });
    await Task.create({
      title: "Follow-up with Ankit",
      linkedEnquiryId: enqRevit._id.toString(),
      assignedTo: "Rahul Mehta",
      dueDate: new Date(),
      status: "Pending",
    });

    const req = new Request("http://localhost:3000/api/enquiries/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transferScope: "course_wise",
        course: "AutoCAD",
        targetAdvisor: "Sneha Sharma",
        targetAdvisorId: targetUser._id.toString(),
        transferRemarks: "Reassigned by course batch head",
      }),
    });

    const res = await transferPostRoute(req);
    const data = await res.json();

    assert.equal(res.status, 200);
    assert.equal(data.success, true);
    assert.equal(data.transferredCount, 2);

    const updatedAutoCad1 = await Enquiry.findById(enqAutoCad1._id);
    assert.equal(updatedAutoCad1.assignedCrmAdvisor, "Sneha Sharma");
    assert.equal(updatedAutoCad1.assignedCrmAdvisorId.toString(), targetUser._id.toString());
    assert.match(updatedAutoCad1.followUps[0].remarks, /Reassigned by course batch head/);

    const updatedAutoCad2 = await Enquiry.findById(enqAutoCad2._id);
    assert.equal(updatedAutoCad2.assignedCrmAdvisor, "Sneha Sharma");

    const unchangedRevit = await Enquiry.findById(enqRevit._id);
    assert.equal(unchangedRevit.assignedCrmAdvisor, "Rahul Mehta");

    const autoCadTask = await Task.findOne({ linkedEnquiryId: enqAutoCad1._id.toString() });
    assert.equal(autoCadTask.assignedTo, "Sneha Sharma");

    const revitTask = await Task.findOne({ linkedEnquiryId: enqRevit._id.toString() });
    assert.equal(revitTask.assignedTo, "Rahul Mehta");
  });
});
