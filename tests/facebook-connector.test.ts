import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
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
process.env.FIELD_ENCRYPTION_KEY = "b".repeat(64);

const APP_SECRET = "test-app-secret";
const PAGE_TOKEN = "EAAG-test-page-token";
const PAGE_ID = "111222333";
const FORM_AUTOCAD = "form-autocad";
const FORM_OTHER = "form-other";

// ---------------------------------------------------------------------------
// Fake Meta Graph API. Anything else (e.g. MSG91) is recorded and rejected.
// ---------------------------------------------------------------------------
const graphLeads: Record<string, any> = {};
const unexpectedCalls: string[] = [];
let failLeadFetch = false;

function makeLead(id: string, formId: string, answers: Record<string, string>, extra: any = {}) {
  const lead = {
    id,
    created_time: new Date().toISOString(),
    form_id: formId,
    ad_id: "ad-1",
    ad_name: "Summer Ad",
    campaign_name: "AutoCAD Oct Campaign",
    platform: "ig",
    is_organic: false,
    field_data: Object.entries(answers).map(([name, v]) => ({ name, values: [v] })),
    ...extra,
  };
  graphLeads[id] = lead;
  return lead;
}

globalThis.fetch = (async (input: any, init?: any) => {
  const url = new URL(String(input?.url ?? input));
  const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  if (url.hostname !== "graph.facebook.com") {
    unexpectedCalls.push(url.toString());
    throw new Error("Outbound network disabled in tests");
  }
  if (url.searchParams.get("access_token") !== PAGE_TOKEN) {
    return json({ error: { message: "Invalid OAuth access token.", code: 190 } }, 400);
  }

  const parts = url.pathname.split("/").filter(Boolean); // [version, ...]
  const [, node, edge] = parts;

  if (!edge && graphLeads[node]) {
    if (failLeadFetch) return json({ error: { message: "Temporary Graph outage", code: 2 } }, 500);
    return json(graphLeads[node]);
  }
  if (node === PAGE_ID && !edge) return json({ id: PAGE_ID, name: "CADD Mantra Lucknow" });
  if (node === PAGE_ID && edge === "leadgen_forms") {
    return json({ data: [{ id: FORM_AUTOCAD, name: "AutoCAD Enquiry", status: "ACTIVE", leads_count: 3 }] });
  }
  if (node === PAGE_ID && edge === "subscribed_apps") {
    return init?.method === "POST" ? json({ success: true }) : json({ data: [] });
  }
  if (edge === "leads") {
    // Two pages to exercise paging.next
    const all = Object.values(graphLeads).filter((l: any) => l.form_id === node);
    const after = Number(url.searchParams.get("after") || 0);
    const pageData = all.slice(after, after + 2);
    const next = after + 2 < all.length ? new URL(url.toString()) : null;
    next?.searchParams.set("after", String(after + 2));
    return json({ data: pageData, paging: next ? { next: next.toString() } : {} });
  }
  return json({ error: { message: `Unknown path ${url.pathname}` } }, 404);
}) as any;

const sign = (body: string, secret = APP_SECRET) =>
  "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

const webhookBody = (leadgenId: string, formId = FORM_AUTOCAD) =>
  JSON.stringify({
    object: "page",
    entry: [
      {
        id: PAGE_ID,
        time: Math.floor(Date.now() / 1000),
        changes: [{ field: "leadgen", value: { leadgen_id: leadgenId, page_id: PAGE_ID, form_id: formId, ad_id: "ad-1" } }],
      },
    ],
  });

describe("Facebook Lead Ads connector", () => {
  let mongod: MongoMemoryServer;
  let NextRequest: any;
  let webhook: any;
  let configRoute: any;
  let pullRoute: any;
  let testRoute: any;
  let connectRoute: any;
  let Enquiry: any;
  let Task: any;
  let FacebookLeadLog: any;
  let FacebookLeadConfig: any;
  let verifyToken = "";

  const WEBHOOK_URL = "http://localhost/api/enquiries/facebook-webhook";
  const deliver = (body: string, signature: string | null = sign(body)) =>
    webhook.POST(
      new NextRequest(WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json", ...(signature ? { "x-hub-signature-256": signature } : {}) },
        body,
      })
    );
  const jsonPost = (route: any, url: string, body: any) =>
    route.POST(new NextRequest(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("facebook_test");

    ({ NextRequest } = await import("next/server"));
    webhook = await import("../src/app/api/enquiries/facebook-webhook/route");
    configRoute = await import("../src/app/api/facebook-integration/route");
    pullRoute = await import("../src/app/api/facebook-integration/pull/route");
    testRoute = await import("../src/app/api/facebook-integration/test/route");
    connectRoute = await import("../src/app/api/facebook-integration/connect/route");
    Enquiry = (await import("../src/models/Enquiry")).default;
    Task = (await import("../src/models/Task")).default;
    FacebookLeadLog = (await import("../src/models/FacebookLeadLog")).default;
    FacebookLeadConfig = (await import("../src/models/FacebookLeadConfig")).default;
    await (await import("../src/lib/db")).default();

    // Configure exactly as the settings screen does. WhatsApp off so nothing is sent.
    const res = await jsonPost(configRoute, "http://localhost/api/facebook-integration", {
      pageId: PAGE_ID,
      pageAccessToken: PAGE_TOKEN,
      appSecret: APP_SECRET,
      defaultBrand: "CADD MANTRA",
      counselorName: "Default Counsellor",
      sendWelcomeWhatsApp: false,
      sendAdminAlertWhatsApp: false,
      formMappings: [
        { formId: FORM_AUTOCAD, formName: "AutoCAD Enquiry", course: "AutoCAD", brand: "CADD MANTRA", counselorName: "Riya (AutoCAD)" },
      ],
    });
    assert.equal((await res.json()).success, true);
    verifyToken = (await (await configRoute.GET()).json()).data.verifyToken;
    assert.match(verifyToken, /^fb-verify-/);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("webhook verification echoes hub.challenge only for the right token", async () => {
    const ok = await webhook.GET(
      new NextRequest(`${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=987654`)
    );
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), "987654");

    const bad = await webhook.GET(new NextRequest(`${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1`));
    assert.equal(bad.status, 403);
  });

  test("signed leadgen webhook fetches the lead and creates a routed enquiry + task", async () => {
    makeLead("L-100", FORM_AUTOCAD, {
      full_name: "Neha Gupta",
      phone_number: "+919812345678",
      email: "neha@example.com",
      city: "Kanpur",
      "preferred_batch_timing?": "Weekend",
    });

    const res = await deliver(webhookBody("L-100"));
    const data = await res.json();
    assert.equal(res.status, 200, JSON.stringify(data));
    assert.equal(data.results[0].status, "SUCCESS", JSON.stringify(data));

    const enquiry = await Enquiry.findOne({ enquiryId: data.results[0].enquiryId }).lean();
    assert.equal(enquiry.studentFullName, "Neha Gupta");
    assert.equal(enquiry.primaryPhoneMobile, "+91 9812345678");
    assert.equal(enquiry.emailAddress, "neha@example.com");
    assert.equal(enquiry.currentCity, "Kanpur");
    assert.equal(enquiry.targetCourse, "AutoCAD");
    assert.equal(enquiry.assignedCrmAdvisor, "Riya (AutoCAD)");
    assert.equal(enquiry.leadSource, "Meta Ads");
    assert.equal(enquiry.utmSource, "instagram");
    assert.equal(enquiry.utmCampaign, "AutoCAD Oct Campaign");
    assert.match(enquiry.remarks, /Meta Lead ID: L-100/);
    assert.match(enquiry.remarks, /Preferred batch timing: Weekend/);
    assert.ok(enquiry.studentId, "student master linked");

    const task = await Task.findOne({ linkedEnquiryId: enquiry._id.toString() }).lean();
    assert.equal(task?.assignedTo, "Riya (AutoCAD)");
  });

  test("redelivered and concurrent deliveries of one lead create exactly one enquiry", async () => {
    makeLead("L-200", FORM_OTHER, { first_name: "Arjun", last_name: "Mehta", phone_number: "9898989898" });
    const body = webhookBody("L-200", FORM_OTHER);
    const results = await Promise.all([deliver(body), deliver(body), deliver(body)].map((p) => p.then((r: any) => r.json())));
    const statuses = results.map((r) => r.results[0].status).sort();
    assert.deepEqual(statuses, ["DUPLICATE", "DUPLICATE", "SUCCESS"]);

    const again = await (await deliver(body)).json();
    assert.equal(again.results[0].status, "DUPLICATE");
    assert.equal(await Enquiry.countDocuments({ primaryPhoneMobile: "+91 9898989898" }), 1);

    // Unmapped form -> defaults
    const enquiry = await Enquiry.findOne({ primaryPhoneMobile: "+91 9898989898" }).lean();
    assert.equal(enquiry.studentFullName, "Arjun Mehta");
    assert.equal(enquiry.assignedCrmAdvisor, "Default Counsellor");
    assert.equal(enquiry.targetCourse, "General Course");
  });

  test("unsigned or wrongly signed webhooks are rejected", async () => {
    makeLead("L-300", FORM_AUTOCAD, { full_name: "Forged", phone_number: "9000000001" });
    const body = webhookBody("L-300");
    assert.equal((await deliver(body, null)).status, 401);
    assert.equal((await deliver(body, sign(body, "other-secret"))).status, 401);
    assert.equal(await Enquiry.countDocuments({ primaryPhoneMobile: "+91 9000000001" }), 0);
  });

  test("Graph failure is logged, acknowledged, and recovered later by pull sync", async () => {
    makeLead("L-400", FORM_AUTOCAD, { full_name: "Kavya Rao", phone_number: "9123412341", "which_course_are_you_interested_in?": "Revit" });
    failLeadFetch = true;
    const res = await deliver(webhookBody("L-400"));
    failLeadFetch = false;
    assert.equal(res.status, 200);
    assert.equal((await res.json()).results[0].status, "FAILED");
    assert.equal(await FacebookLeadLog.countDocuments({ leadgenId: "L-400", status: "FAILED" }), 1);
    assert.equal(await Enquiry.countDocuments({ primaryPhoneMobile: "+91 9123412341" }), 0);

    // Extra leads so pull has to follow paging.next
    makeLead("L-401", FORM_AUTOCAD, { full_name: "Pull One", phone_number: "9111100001" });
    makeLead("L-402", FORM_AUTOCAD, { full_name: "Pull Two", phone_number: "9111100002" });

    const pull = await (await jsonPost(pullRoute, "http://localhost/api/facebook-integration/pull", {})).json();
    assert.equal(pull.success, true, JSON.stringify(pull));
    // FORM_AUTOCAD has L-100 (already imported), L-300 (never imported), L-400, L-401, L-402
    assert.equal(pull.fetched, 5);
    assert.equal(pull.imported, 4);
    assert.equal(pull.duplicates, 1);
    assert.equal(await Enquiry.countDocuments({ primaryPhoneMobile: "+91 9123412341" }), 1);

    const pullAgain = await (await jsonPost(pullRoute, "http://localhost/api/facebook-integration/pull", {})).json();
    assert.equal(pullAgain.imported, 0);
    assert.equal(pullAgain.duplicates, 5);
  });

  test("settings never return secrets, and blank secrets on save keep the stored ones", async () => {
    const data = (await (await configRoute.GET()).json()).data;
    assert.equal(data.appSecret, undefined);
    assert.equal(data.pageAccessToken, undefined);
    assert.equal(data.hasAppSecret, true);
    assert.equal(data.hasPageAccessToken, true);

    await jsonPost(configRoute, "http://localhost/api/facebook-integration", { ...data, appSecret: "", pageAccessToken: "" });

    const raw = await FacebookLeadConfig.findOne({}).select("+appSecret +pageAccessToken").lean();
    assert.match(raw.appSecret, /^enc:v1:/);
    assert.match(raw.pageAccessToken, /^enc:v1:/);
    // Still works end to end after the re-save
    makeLead("L-500", FORM_AUTOCAD, { full_name: "After Save", phone_number: "9555500005" });
    const res = await (await deliver(webhookBody("L-500"))).json();
    assert.equal(res.results[0].status, "SUCCESS");
  });

  test("connection check lists forms and subscribe calls Meta", async () => {
    const check = await (await connectRoute.GET()).json();
    assert.equal(check.success, true, JSON.stringify(check));
    assert.equal(check.page.name, "CADD Mantra Lucknow");
    assert.equal(check.forms[0].id, FORM_AUTOCAD);
    assert.equal(check.leadgenSubscribed, false);

    const sub = await (await connectRoute.POST()).json();
    assert.equal(sub.success, true);
  });

  test("simulator creates an enquiry without calling Meta", async () => {
    const res = await (
      await jsonPost(testRoute, "http://localhost/api/facebook-integration/test", {
        name: "Sim Lead",
        phone: "+91 97777 77777",
        course: "3ds Max",
      })
    ).json();
    assert.equal(res.success, true, JSON.stringify(res));
    assert.equal(res.status, "SUCCESS");
    assert.equal(res.matchedCourse, "3ds Max");
  });

  test("nothing outside the fake Graph API was called", () => {
    assert.deepEqual(unexpectedCalls, []);
  });
});
