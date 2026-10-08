// Run with: node --test --experimental-test-module-mocks tests/batch-flow.test.ts
import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";

register(pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href, pathToFileURL(process.cwd() + "/"));
process.env.DISABLE_CRON = "true";
process.env.FIELD_ENCRYPTION_KEY = "d".repeat(64);
globalThis.fetch = (async () => {
  throw new Error("network disabled in tests");
}) as any;

let currentUser: any = null;
mock.module(pathToFileURL(path.resolve(process.cwd(), "src/lib/helper.ts")).href, {
  namedExports: {
    getUserFromCookies: async () => currentUser,
    canDeleteFinancialRecords: () => true,
    escapeRegex: (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  },
});

describe("Batch creation and student assignment", () => {
  let mongod: MongoMemoryServer;
  let batches: any, batch: any, admission: any;
  let teacherA: any, teacherB: any;
  const admin = { _id: new mongoose.Types.ObjectId(), name: "Asha Admin", role: "admin", brandScope: "All Brands" };
  const db = () => mongoose.connection.db!;

  const call = async (handler: any, url: string, init: any = {}, ctxParams?: Record<string, string>) => {
    const res = await handler(new Request(`http://localhost${url}`, init), ctxParams ? { params: Promise.resolve(ctxParams) } : undefined);
    return { status: res.status, json: await res.json() };
  };
  const send = (method: string, handler: any, url: string, body: any, ctxParams?: Record<string, string>) =>
    call(handler, url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, ctxParams);

  const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const base = () => ({
    batchName: `Batch ${Math.random().toString(36).slice(2, 7)}`,
    courses: ["Course X"],
    teacherId: String(teacherA._id),
    brand: "BRAND A",
    startDate: day(0),
    timing: "10:00 AM - 12:00 PM",
    days: ["Mon", "Wed"],
    maxCapacity: 30,
  });
  const create = (overrides: any = {}) => send("POST", batches.POST, "/api/batches", { ...base(), ...overrides });
  const addStudent = async (fields: any) => {
    const doc = { admissionId: `ADM${Math.floor(Math.random() * 1e6)}`, status: "Active", brand: "BRAND A", batch: "Unassigned", batchId: null, finalFee: 0, ...fields };
    const r = await db().collection("admissions").insertOne(doc);
    return { ...doc, _id: r.insertedId };
  };
  const assign = (student: any, b: any) =>
    send("PUT", admission.PUT, `/api/admissions/${student._id}`, { batch: b.batchName, batchId: b.batchId }, { id: String(student._id) });

  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("batch_test");
    batches = await import("../src/app/api/batches/route");
    batch = await import("../src/app/api/batches/[id]/route");
    admission = await import("../src/app/api/admissions/[id]/route");
    await (await import("../src/lib/db")).default();
    currentUser = admin;
    const t = await db().collection("users").insertMany([
      { name: "Teacher A", role: "teacher", email: "a@example.com" },
      { name: "Teacher B", role: "teacher", email: "b@example.com" },
    ]);
    teacherA = { _id: t.insertedIds[0] };
    teacherB = { _id: t.insertedIds[1] };
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("an admin can create a batch (role is no longer limited to a fixed list) and the creator comes from the session", async () => {
    currentUser = { ...admin, role: "Super Admin" };
    const res = await create({ createdBy: "spoofed", creatorRole: "teacher" });
    currentUser = admin;
    assert.equal(res.status, 201, JSON.stringify(res.json));
    assert.match(res.json.data.batchId, /^BAT\d{6}$/);
    assert.equal(res.json.data.createdBy, "Asha Admin");
    assert.equal(res.json.data.creatorRole, "Super Admin");
    assert.equal(res.json.data.teacherName, "Teacher A", "teacher name taken from the user record");
  });

  test("rejects missing days, end before start, bad timing, and 'All Brands' as a brand", async () => {
    assert.equal((await create({ days: [], teacherId: String(teacherB._id) })).status, 400);
    assert.equal((await create({ startDate: day(5), endDate: day(1), teacherId: String(teacherB._id) })).status, 400);
    assert.equal((await create({ timing: "morning", teacherId: String(teacherB._id) })).status, 400);
    assert.equal((await create({ brand: "All Brands", teacherId: String(teacherB._id) })).status, 400);
    assert.equal((await create({ teacherId: "not-an-id" })).status, 400);
  });

  test("a teacher can't be double-booked; a different day or time is fine", async () => {
    const first = await create({ teacherId: String(teacherB._id), timing: "2:00 PM - 4:00 PM", days: ["Tue"] });
    assert.equal(first.status, 201, JSON.stringify(first.json));
    const clash = await create({ teacherId: String(teacherB._id), timing: "3:00 PM - 5:00 PM", days: ["Tue", "Thu"] });
    assert.equal(clash.status, 409);
    assert.match(clash.json.error, /already teaches/);
    assert.equal((await create({ teacherId: String(teacherB._id), timing: "3:00 PM - 5:00 PM", days: ["Thu"] })).status, 201);
    assert.equal((await create({ teacherId: String(teacherB._id), timing: "4:00 PM - 6:00 PM", days: ["Tue"] })).status, 201, "back-to-back is not a clash");
  });

  test("batch names are unique within a brand", async () => {
    const name = "Unique Name Test";
    assert.equal((await create({ batchName: name, teacherId: String(teacherA._id), days: ["Sat"], timing: "8:00 AM - 9:00 AM" })).status, 201);
    assert.equal((await create({ batchName: name.toUpperCase(), teacherId: String(teacherA._id), days: ["Sun"], timing: "8:00 AM - 9:00 AM" })).status, 409);
    assert.equal((await create({ batchName: name, brand: "BRAND B", teacherId: String(teacherA._id), days: ["Sun"], timing: "8:00 AM - 9:00 AM" })).status, 201);
  });

  test("codes stay unique even when old batches were numbered without the counter", async () => {
    await db().collection("batches").insertMany([
      { batchId: "BAT000500", batchName: "Legacy", brand: "BRAND A", teacherId: teacherA._id, teacherName: "Teacher A", startDate: new Date(), timing: "6:00 PM - 7:00 PM", days: ["Fri"], status: "Active" },
      // two batches without any code: the old list view gave both the same code and failed
      { batchName: "No code 1", brand: "BRAND A", teacherId: teacherA._id, teacherName: "Teacher A", startDate: new Date(), timing: "7:00 AM - 8:00 AM", days: ["Fri"], status: "Active" },
      { batchName: "No code 2", brand: "BRAND A", teacherId: teacherA._id, teacherName: "Teacher A", startDate: new Date(), timing: "7:00 AM - 8:00 AM", days: ["Sat"], status: "Active" },
    ]);
    const list = await call(batches.GET, "/api/batches");
    assert.equal(list.status, 200, JSON.stringify(list.json).slice(0, 300));
    const codes = list.json.data.map((b: any) => b.batchId);
    assert.equal(new Set(codes).size, codes.length, "every batch has a distinct code");
    const fresh = await create({ teacherId: String(teacherB._id), days: ["Sun"], timing: "10:00 AM - 11:00 AM" });
    assert.equal(fresh.status, 201, JSON.stringify(fresh.json));
    assert.ok(!codes.includes(fresh.json.data.batchId));
  });

  test("a brand-restricted user only sees their brand, even when filtering by teacher", async () => {
    await create({ brand: "BRAND B", teacherId: String(teacherA._id), days: ["Thu"], timing: "1:00 PM - 2:00 PM" });
    currentUser = { _id: new mongoose.Types.ObjectId(), name: "Manager A", role: "manager", brandScope: "BRAND A" };
    const list = await call(batches.GET, `/api/batches?teacherId=${teacherA._id}`);
    currentUser = admin;
    assert.equal(list.status, 200);
    assert.ok(list.json.data.length > 0);
    assert.ok(list.json.data.every((b: any) => b.brand === "BRAND A"), "teacher filter no longer drops the brand restriction");
  });

  test("assignment respects capacity, brand, status and existence", async () => {
    const small = await create({ maxCapacity: 1, teacherId: String(teacherA._id), days: ["Tue"], timing: "6:00 PM - 7:00 PM" });
    assert.equal(small.status, 201, JSON.stringify(small.json));
    const b = small.json.data;
    const s1 = await addStudent({ fullName: "Student One" });
    const s2 = await addStudent({ fullName: "Student Two" });
    const other = await addStudent({ fullName: "Other Brand", brand: "BRAND B" });

    assert.equal((await assign(s1, b)).status, 200);
    const full = await assign(s2, b);
    assert.equal(full.status, 409);
    assert.match(full.json.message, /full/);
    assert.equal((await assign(other, b)).status, 400, "brand mismatch");
    assert.equal(
      (await send("PUT", admission.PUT, `/api/admissions/${s2._id}`, { batch: "x", batchId: String(new mongoose.Types.ObjectId()) }, { id: String(s2._id) })).status,
      400,
      "unknown batch is refused instead of stored"
    );

    // capacity can't be cut below enrolment; re-saving the same student isn't counted twice
    assert.equal((await send("PATCH", batch.PATCH, `/api/batches/${b._id}`, { maxCapacity: 0 }, { id: b._id })).status, 400);
    assert.equal((await assign(s1, b)).status, 200);

    const cancelled = await send("PATCH", batch.PATCH, `/api/batches/${b._id}`, { status: "Cancelled" }, { id: b._id });
    assert.equal(cancelled.status, 200);
    const s3 = await addStudent({ fullName: "Student Three" });
    assert.equal((await assign(s3, b)).status, 400, "cancelled batch");
  });

  test("the student is found by id, not by a shared name", async () => {
    const b = (await create({ teacherId: String(teacherB._id), days: ["Sat"], timing: "11:00 AM - 12:00 PM" })).json.data;
    const twinA = await addStudent({ fullName: "Rahul Sharma", mobileNumber: "9000000001" });
    const twinB = await addStudent({ fullName: "Rahul Sharma", mobileNumber: "9000000002" });
    const res = await send("PUT", admission.PUT, `/api/admissions/${twinB._id}`, { batch: b.batchName, batchId: b.batchId, fullName: "Rahul Sharma" }, { id: String(twinB._id) });
    assert.equal(res.status, 200, JSON.stringify(res.json));
    const a = await db().collection("admissions").findOne({ _id: twinA._id });
    const bb = await db().collection("admissions").findOne({ _id: twinB._id });
    assert.equal(a!.batchId, null, "the other Rahul is untouched");
    assert.equal(String(bb!.batchId), String(b._id));
  });

  test("Completed set by hand sticks; end date can be cleared; rename reaches students", async () => {
    const b = (await create({ teacherId: String(teacherB._id), days: ["Fri"], timing: "9:00 AM - 10:00 AM", endDate: day(60) })).json.data;
    const s = await addStudent({ fullName: "Renamed Student" });
    await assign(s, b);

    const done = await send("PATCH", batch.PATCH, `/api/batches/${b._id}`, { status: "Completed" }, { id: b._id });
    assert.equal(done.json.data.status, "Completed");
    const after1 = (await call(batches.GET, `/api/batches?batchId=${b.batchId}`)).json.data[0];
    assert.equal(after1.status, "Completed", "list view no longer flips it back to Active");

    const reopened = await send("PATCH", batch.PATCH, `/api/batches/${b._id}`, { status: "Active", endDate: null }, { id: b._id });
    assert.equal(reopened.status, 200, JSON.stringify(reopened.json));
    assert.equal(reopened.json.data.status, "Active");
    assert.equal(reopened.json.data.endDate, undefined, "end date removed");

    await send("PATCH", batch.PATCH, `/api/batches/${b._id}`, { batchName: "Renamed Batch" }, { id: b._id });
    const st = await db().collection("admissions").findOne({ _id: s._id });
    assert.equal(st!.batch, "Renamed Batch", "student's batch name updated even though it stores the ObjectId");
  });

  test("delete: blocked with students or for counsellors, allowed when empty", async () => {
    const b = (await create({ teacherId: String(teacherA._id), days: ["Sun"], timing: "2:00 PM - 3:00 PM" })).json.data;
    const s = await addStudent({ fullName: "Blocker" });
    await assign(s, b);

    currentUser = { _id: new mongoose.Types.ObjectId(), name: "C", role: "counsellor", brandScope: "BRAND A" };
    assert.equal((await call(batch.DELETE, `/api/batches/${b._id}`, { method: "DELETE" }, { id: b._id })).status, 403);
    currentUser = admin;

    const blocked = await call(batch.DELETE, `/api/batches/${b._id}`, { method: "DELETE" }, { id: b._id });
    assert.equal(blocked.status, 409);
    await send("PUT", admission.PUT, `/api/admissions/${s._id}`, { batch: "Unassigned", batchId: "" }, { id: String(s._id) });
    assert.equal((await call(batch.DELETE, `/api/batches/${b._id}`, { method: "DELETE" }, { id: b._id })).status, 200);
  });
});
