import { test, describe, before, after } from "node:test";
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
process.env.FIELD_ENCRYPTION_KEY = "a".repeat(64);
delete process.env.JUSTDIAL_WEBHOOK_SECRET;

// msg91.ts falls back to a hard-coded auth key, so block every outbound request from this test.
const outboundCalls: string[] = [];
globalThis.fetch = (async (input: any) => {
  outboundCalls.push(String(input?.url ?? input));
  throw new Error("Outbound network disabled in tests");
}) as any;

const WEBHOOK_URL = "http://localhost/api/enquiries/justdial-webhook";

describe("Justdial connector", () => {
  let mongod: MongoMemoryServer;
  let NextRequest: any;
  let webhook: { POST: any; GET: any };
  let configRoute: { GET: any; POST: any };
  let Enquiry: any;
  let Task: any;
  let JustdialConfig: any;
  let JustdialLeadLog: any;

  const postJson = (payload: any, headers: Record<string, string> = {}) =>
    webhook.POST(
      new NextRequest(WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(payload),
      })
    );

  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("justdial_test");

    ({ NextRequest } = await import("next/server"));
    webhook = await import("../src/app/api/enquiries/justdial-webhook/route");
    configRoute = await import("../src/app/api/justdial-integration/route");
    Enquiry = (await import("../src/models/Enquiry")).default;
    Task = (await import("../src/models/Task")).default;
    JustdialConfig = (await import("../src/models/JustdialConfig")).default;
    JustdialLeadLog = (await import("../src/models/JustdialLeadLog")).default;

    const dbConnect = (await import("../src/lib/db")).default;
    await dbConnect();

    // Save config through the settings API, as the UI does. WhatsApp off so nothing is sent.
    const res = await configRoute.POST(
      new NextRequest("http://localhost/api/justdial-integration", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey: "JD-KEY-TESTSECRET123",
          pullApiKey: "PULL-SECRET-XYZ",
          requireApiKey: false,
          sendWelcomeWhatsApp: false,
          sendAdminAlertWhatsApp: false,
          courseMappings: [{ course: "AutoCAD", justdialCategory: "AutoCAD Training Institutes", brand: "BRAND A" }],
        }),
      })
    );
    assert.equal((await res.json()).success, true);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("push webhook creates an enquiry, task and success log", async () => {
    const res = await postJson({
      leadid: "JD-LEAD-1001",
      prefix: "Mr",
      name: "Mr. Rahul Verma",
      mobile: "919876543210",
      email: "rahul@example.com",
      city: "Lucknow",
      area: "Gomti Nagar",
      category: "AutoCAD Training Institutes",
    });
    const data = await res.json();
    assert.equal(res.status, 200, JSON.stringify(data));
    assert.equal(data.status, "SUCCESS");
    assert.equal(data.matchedCourse, "AutoCAD");

    const enquiry = await Enquiry.findOne({ enquiryId: data.enquiryId }).lean();
    assert.ok(enquiry, "enquiry saved");
    assert.match(enquiry.enquiryId, /^ENQ\d+$/);
    assert.equal(enquiry.studentFullName, "Rahul Verma");
    assert.equal(enquiry.primaryPhoneMobile, "+91 9876543210");
    assert.ok(enquiry.studentId, "student master linked");

    assert.equal(await Task.countDocuments({ linkedEnquiryId: enquiry._id.toString() }), 1);
    const log = await JustdialLeadLog.findOne({ leadId: "JD-LEAD-1001" }).lean();
    assert.equal(log?.status, "SUCCESS");
  });

  test("re-pushed lead ID is deduplicated without creating a new enquiry", async () => {
    const before = await Enquiry.countDocuments({});
    const res = await postJson({ leadid: "JD-LEAD-1001", name: "Rahul Verma", mobile: "9876543210" });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.isDuplicate, true);
    assert.equal(await Enquiry.countDocuments({}), before);
  });

  test("GET push with query params and numeric fields does not crash", async () => {
    const url = `${WEBHOOK_URL}?leadid=JD-LEAD-2002&name=12345&mobile=9123456780&category=Revit`;
    const res = await webhook.GET(new NextRequest(url, { method: "GET" }));
    const data = await res.json();
    assert.equal(res.status, 200, JSON.stringify(data));
    assert.equal(data.status, "SUCCESS");
  });

  test("form-encoded push is accepted", async () => {
    const res = await webhook.POST(
      new NextRequest(WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "leadid=JD-LEAD-3003&name=Priya+Singh&mobile=9000011111&category=Interior+Design",
      })
    );
    const data = await res.json();
    assert.equal(res.status, 200, JSON.stringify(data));
    const enquiry = await Enquiry.findOne({ enquiryId: data.enquiryId }).lean();
    assert.equal(enquiry.studentFullName, "Priya Singh");
  });

  test("concurrent leads get distinct enquiry IDs (no unique-index collisions)", async () => {
    const results = await Promise.all(
      [0, 1, 2, 3, 4].map((i) =>
        postJson({ leadid: `JD-CONC-${i}`, name: `Lead ${i}`, mobile: `98000000${10 + i}` }).then((r: any) => r.json())
      )
    );
    for (const r of results) assert.equal(r.status, "SUCCESS", JSON.stringify(r));
    assert.equal(new Set(results.map((r) => r.enquiryId)).size, 5);
  });

  test("API key is enforced when required", async () => {
    await JustdialConfig.updateOne({}, { $set: { requireApiKey: true } });

    const bad = await postJson({ leadid: "JD-KEY-1", name: "X", mobile: "9111111111" }, { "x-api-key": "wrong" });
    assert.equal(bad.status, 401);
    const badLog = await JustdialLeadLog.findOne({ status: "UNAUTHORIZED" }).sort({ timestamp: -1 }).lean();
    assert.ok(!String(badLog.errorDetails).includes("wrong"), "attempted key not written to logs");

    const good = await postJson(
      { leadid: "JD-KEY-2", name: "Y", mobile: "9222222222" },
      { "x-api-key": "JD-KEY-TESTSECRET123" }
    );
    assert.equal(good.status, 200, JSON.stringify(await good.json()));

    await JustdialConfig.updateOne({}, { $set: { requireApiKey: false } });
  });

  test("settings GET exposes the API key but never the pull secret; blank save keeps secrets", async () => {
    const get = async () => (await (await configRoute.GET()).json()).data;

    let data = await get();
    assert.equal(data.apiKey, "JD-KEY-TESTSECRET123");
    assert.equal(data.pullApiKey, "");
    assert.equal(data.hasPullApiKey, true);
    assert.equal(data.webhookSecret, undefined);

    // Re-save exactly what the modal would send back (pull secret blank)
    const res = await configRoute.POST(
      new NextRequest("http://localhost/api/justdial-integration", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...data, pullApiKey: "" }),
      })
    );
    const saved = await res.json();
    assert.equal(saved.success, true);
    assert.equal(saved.data.apiKey, undefined, "save response does not echo secrets");

    data = await get();
    assert.equal(data.apiKey, "JD-KEY-TESTSECRET123");
    assert.equal(data.hasPullApiKey, true);

    const raw = await JustdialConfig.findOne({}).select("+pullApiKey +apiKey").lean();
    assert.match(raw.pullApiKey, /^enc:v1:/, "pull secret encrypted at rest");
    assert.match(raw.apiKey, /^enc:v1:/, "api key encrypted at rest");
  });

  test("no outbound network calls were attempted", () => {
    assert.deepEqual(outboundCalls, []);
  });
});
