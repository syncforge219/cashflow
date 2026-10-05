// Run with: node --test --experimental-test-module-mocks tests/marketing-role.test.ts
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
process.env.FIELD_ENCRYPTION_KEY = "f".repeat(64);

// No real WhatsApp/email
globalThis.fetch = (async () => {
  throw new Error("network disabled in tests");
}) as any;

// Route handlers read the user from Next's request cookies; in tests we choose the user directly.
let currentUser: any = null;
mock.module(pathToFileURL(path.resolve(process.cwd(), "src/lib/helper.ts")).href, {
  namedExports: {
    getUserFromCookies: async () => currentUser,
    canDeleteFinancialRecords: () => false,
    escapeRegex: (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  },
});

describe("Marketing Executive role", () => {
  let mongod: MongoMemoryServer;
  let NextRequest: any;
  let proxy: any;
  let createSession: any;
  let leadsRoute: any, spendRoute: any, summaryRoute: any, lookupsRoute: any;
  let fbConfigRoute: any;
  let ingestFacebookLead: any, loadFacebookConfig: any;
  let User: any, Enquiry: any, Admission: any;
  let mkt: any, mkt2: any, admin: any;
  let mktToken = "";
  let legacyToken = "";

  const call = async (handler: any, url: string, init: any = {}) => {
    const res = await handler(new Request(`http://localhost${url}`, init));
    return { status: res.status, json: await res.json() };
  };
  const postJson = (handler: any, url: string, body: any) =>
    call(handler, url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("marketing_test");
    ({ NextRequest } = await import("next/server"));
    ({ proxy } = await import("../src/proxy"));
    ({ createSession } = await import("../src/lib/auth"));
    leadsRoute = await import("../src/app/api/marketing/leads/route");
    spendRoute = await import("../src/app/api/marketing/spend/route");
    summaryRoute = await import("../src/app/api/marketing/summary/route");
    lookupsRoute = await import("../src/app/api/marketing/lookups/route");
    fbConfigRoute = await import("../src/app/api/facebook-integration/route");
    ({ ingestFacebookLead, loadFacebookConfig } = await import("../src/lib/facebookLeads"));
    User = (await import("../src/models/User")).default;
    Enquiry = (await import("../src/models/Enquiry")).default;
    Admission = (await import("../src/models/Admission")).default;
    await (await import("../src/lib/db")).default();

    const mk = (name: string, role: string) =>
      User.create({ name, email: `${name.replace(/\s/g, "").toLowerCase()}@example.com`, password: "$2a$10$abcdefghijklmnopqrstuv", role });
    mkt = await mk("Meera Marketing", "marketing executive");
    mkt2 = await mk("Other Marketer", "marketing executive");
    admin = await mk("Asha Admin", "super admin");
    const legacy = await mk("Old Marketing", "marketing lead");
    await mk("Ravi Counsellor", "counsellor");
    mktToken = (await createSession(String(mkt._id))).sessionToken;
    legacyToken = (await createSession(String(legacy._id))).sessionToken;

    // A lead entered by staff (not the marketing user) -> must never be visible to them
    await Enquiry.create({ studentFullName: "Staff Lead", primaryPhoneMobile: "+91 9000000001", leadSource: "Walk-in", targetBrand: "CADD MANTRA" });
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  const viaProxy = async (pathname: string, token: string, method = "GET") => {
    const res = await proxy(new NextRequest(`http://localhost${pathname}`, { method, headers: { cookie: `session_token=${token}` } }));
    return res.status;
  };

  test("proxy: marketing user reaches only leads, spend and connector APIs", async () => {
    for (const p of ["/api/marketing/leads", "/api/marketing/summary", "/api/justdial-integration", "/api/facebook-integration/logs", "/api/lead-sources"]) {
      assert.equal(await viaProxy(p, mktToken), 200, p);
    }
    for (const p of [
      "/api/payments",
      "/api/admissions",
      "/api/enquiries",
      "/api/pending-collection",
      "/api/admin-dashboard/stats",
      "/api/reports/collections",
      "/api/users",
      "/api/brands",
      "/api/counsellors",
      "/api/expenses",
      "/api/ai-assistant",
      "/api/students",
    ]) {
      assert.equal(await viaProxy(p, mktToken), 403, p);
    }
    assert.equal(await viaProxy("/api/lead-sources", mktToken, "DELETE"), 403, "lead sources: read/add only");
  });

  test("legacy decommissioned marketing roles stay locked out", async () => {
    assert.equal(await viaProxy("/api/marketing/leads", legacyToken), 401);
  });

  test("pages: proxy passes the path so the layout can keep marketing users on their dashboard", async () => {
    const res = await proxy(new NextRequest("http://localhost/admin-dashboard"));
    assert.equal(res.headers.get("x-middleware-request-x-pathname"), "/admin-dashboard");
  });

  test("adding a lead: whitelisted fields only, owned by the marketing user, counsellor optional", async () => {
    currentUser = mkt.toObject();
    const { status, json } = await postJson(leadsRoute.POST, "/api/marketing/leads", {
      name: "Priya Lead",
      phone: "98765 43210",
      source: "Meta Ads",
      campaign: "Oct AutoCAD",
      brand: "CADD MANTRA",
      course: "AutoCAD",
      counsellor: "Ravi Counsellor",
      status: "Admitted", // ignored
      isAdmitted: true, // ignored
      expectedCourseFee: "₹99,999", // ignored
    });
    assert.equal(status, 201, JSON.stringify(json));
    assert.deepEqual(Object.keys(json.data).sort(), ["_id", "addedBy", "brand", "campaign", "city", "converted", "course", "createdAt", "date", "email", "enquiryId", "name", "phone", "source"].sort());

    const saved = await Enquiry.findById(json.data._id).lean();
    assert.equal(String(saved.addedByUserId), String(mkt._id));
    assert.equal(saved.status, "New");
    assert.notEqual(saved.isAdmitted, true);
    assert.equal(saved.assignedCrmAdvisor, "Ravi Counsellor");
    assert.equal(saved.primaryPhoneMobile, "+91 9876543210");
    assert.notEqual(saved.expectedCourseFee, "₹99,999", "client cannot set fee fields");

    // Unknown counsellor -> Unassigned (not the marketing user)
    const r2 = await postJson(leadsRoute.POST, "/api/marketing/leads", { name: "Second", phone: "9876500000", source: "Google Ads", counsellor: "Nobody" });
    assert.equal(r2.status, 201, JSON.stringify(r2.json));
    assert.equal((await Enquiry.findById(r2.json.data._id).lean()).assignedCrmAdvisor, "Unassigned");

    const bad = await postJson(leadsRoute.POST, "/api/marketing/leads", { name: "X", phone: "123", source: "Meta Ads" });
    assert.equal(bad.status, 400);
  });

  test("lead list shows only own leads, with contact/source fields only", async () => {
    currentUser = mkt.toObject();
    const { json } = await call(leadsRoute.GET, "/api/marketing/leads");
    assert.deepEqual(json.data.map((l: any) => l.name).sort(), ["Priya Lead", "Second"]);
    assert.ok(!JSON.stringify(json).includes("Staff Lead"));
    for (const field of ["remarks", "followUps", "expectedCourseFee", "assignedCrmAdvisor", "studentId"]) {
      assert.ok(!(field in json.data[0]), `${field} must not be exposed`);
    }

    currentUser = mkt2.toObject();
    assert.equal((await call(leadsRoute.GET, "/api/marketing/leads")).json.data.length, 0, "other marketer sees none");
  });

  test("spend log + cost per lead and per admission (counts only, no fee amounts)", async () => {
    currentUser = mkt.toObject();
    const today = (await import("../src/lib/dates")).todayKey();
    assert.equal((await postJson(spendRoute.POST, "/api/marketing/spend", { date: today, source: "meta ads", campaign: "Oct AutoCAD", amount: 3000 })).status, 201);
    assert.equal((await postJson(spendRoute.POST, "/api/marketing/spend", { date: today, source: "Google Ads", amount: 1000 })).status, 201);
    assert.equal((await postJson(spendRoute.POST, "/api/marketing/spend", { date: "2999-01-01", source: "Meta Ads", amount: 5 })).status, 400);
    assert.equal((await postJson(spendRoute.POST, "/api/marketing/spend", { date: today, source: "Meta Ads", amount: 0 })).status, 400);

    // The Meta lead becomes an admission (linked by enquiryId)
    const lead = await Enquiry.findOne({ studentFullName: "Priya Lead" });
    await Admission.create({ fullName: "Priya Lead", enquiryId: lead._id, finalFee: 50000, brand: "CADD MANTRA" });

    const { json } = await call(summaryRoute.GET, "/api/marketing/summary");
    assert.equal(json.success, true, JSON.stringify(json));
    assert.deepEqual(json.data.totals, { spend: 4000, leads: 2, admissions: 1, costPerLead: 2000, costPerAdmission: 4000, conversionPct: 50 });
    const meta = json.data.bySource.find((r: any) => r.key === "meta ads");
    assert.equal(meta.spend, 3000);
    assert.equal(meta.leads, 1);
    assert.equal(meta.costPerLead, 3000);
    assert.equal(json.data.byCampaign.find((r: any) => r.key === "oct autocad").costPerAdmission, 3000);
    assert.ok(!JSON.stringify(json).includes("50000"), "no fee amounts in the summary");

    // Other marketer sees none of it; cannot delete someone else's spend
    const myRows = (await call(spendRoute.GET, "/api/marketing/spend")).json.data;
    currentUser = mkt2.toObject();
    assert.equal((await call(summaryRoute.GET, "/api/marketing/summary")).json.data.totals.spend, 0);
    assert.equal((await call(spendRoute.DELETE, `/api/marketing/spend?id=${myRows[0]._id}`, { method: "DELETE" })).status, 404);
  });

  test("admins see every marketing user's figures; other roles are refused", async () => {
    currentUser = admin.toObject();
    const { json } = await call(summaryRoute.GET, "/api/marketing/summary");
    assert.equal(json.data.totals.spend, 4000);
    assert.equal((await call(lookupsRoute.GET, "/api/marketing/lookups")).json.data.marketingUsers.length, 2);

    currentUser = { _id: new mongoose.Types.ObjectId(), name: "Ravi", role: "counsellor" };
    assert.equal((await call(summaryRoute.GET, "/api/marketing/summary")).status, 403);
  });

  test("leads from a connector the marketing user set up are counted as theirs", async () => {
    currentUser = mkt.toObject();
    const saved = await postJson(fbConfigRoute.POST, "/api/facebook-integration", { pageId: "123", sendWelcomeWhatsApp: false, sendAdminAlertWhatsApp: false });
    assert.equal(saved.json.success, true, JSON.stringify(saved.json));

    // Admin edits the connector later: ownership stays with the marketing user
    currentUser = admin.toObject();
    await postJson(fbConfigRoute.POST, "/api/facebook-integration", { defaultCourse: "Revit" });

    const config = await loadFacebookConfig();
    await ingestFacebookLead(
      { id: "L-1", form_id: "f1", field_data: [{ name: "full_name", values: ["FB Person"] }, { name: "phone_number", values: ["+919111122222"] }] },
      config,
      { sourceType: "SIMULATION_TEST", sendWhatsApp: false }
    );

    currentUser = mkt.toObject();
    const names = (await call(leadsRoute.GET, "/api/marketing/leads")).json.data.map((l: any) => l.name);
    assert.ok(names.includes("FB Person"), names.join(","));
  });
});
