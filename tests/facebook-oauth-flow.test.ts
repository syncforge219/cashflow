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
process.env.FIELD_ENCRYPTION_KEY = "c".repeat(64);

let mongod: MongoMemoryServer;

describe("Facebook Connector OAuth Divert & Flow", () => {
  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    await mongoose.connect(mongod.getUri());
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("buildFacebookOAuthUrl formats a valid Meta OAuth dialog URL with correct redirect & scopes", async () => {
    const { buildFacebookOAuthUrl } = await import("@/lib/facebookLeads");
    const origin = "https://example.com";
    const state = "test-encrypted-state-123";
    const appId = "1234567890";
    const oauthUrl = buildFacebookOAuthUrl(origin, state, appId, "v22.0");

    const parsed = new URL(oauthUrl);
    assert.equal(parsed.origin, "https://www.facebook.com");
    assert.equal(parsed.pathname, "/v22.0/dialog/oauth");
    assert.equal(parsed.searchParams.get("client_id"), appId);
    assert.equal(parsed.searchParams.get("redirect_uri"), "https://example.com/api/facebook-integration/oauth/callback");
    assert.equal(parsed.searchParams.get("state"), state);
    assert.equal(parsed.searchParams.get("response_type"), "code");
    assert.ok(parsed.searchParams.get("scope")?.includes("leads_retrieval"));
    assert.ok(parsed.searchParams.get("scope")?.includes("pages_show_list"));
    assert.ok(parsed.searchParams.get("scope")?.includes("pages_manage_metadata"));
  });

  test("Disconnect and page selection routes operate on FacebookLeadConfig", async () => {
    const FacebookLeadConfig = (await import("@/models/FacebookLeadConfig")).default;
    const { POST: selectPageHandler } = await import("@/app/api/facebook-integration/select-page/route");
    const { POST: disconnectHandler } = await import("@/app/api/facebook-integration/disconnect/route");
    const { encryptJson } = await import("@/lib/encryption");

    // Setup an initial active doc
    await FacebookLeadConfig.deleteMany({});
    await FacebookLeadConfig.create({
      appId: "fb-app-1",
      pageId: "page-1",
      pageName: "Main Academy Page",
      pageAccessToken: "EAAG-token-1",
      isConnected: true,
      availablePages: [
        { id: "page-1", name: "Main Academy Page", category: "Education" },
        { id: "page-2", name: "Branch Campus Page", category: "Education" },
      ],
      encryptedPagesData: encryptJson([
        { id: "page-1", name: "Main Academy Page", access_token: "EAAG-token-1" },
        { id: "page-2", name: "Branch Campus Page", access_token: "EAAG-token-2" },
      ]) || "",
    });

    // Test page switching (faking graphFetch to succeed for subscription)
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as any;

    try {
      const switchReq: any = {
        json: async () => ({ pageId: "page-2" }),
      };
      const switchRes = await selectPageHandler(switchReq);
      const switchData = await switchRes.json();

      assert.equal(switchRes.status, 200);
      assert.equal(switchData.success, true);
      assert.equal(switchData.page.id, "page-2");

      const updated: any = await FacebookLeadConfig.findOne({});
      assert.equal(updated?.pageId, "page-2");
      assert.equal(updated?.pageName, "Branch Campus Page");

      // Test disconnect
      const discRes = await disconnectHandler();
      const discData = await discRes.json();
      assert.equal(discData.success, true);

      const afterDisconnect: any = await FacebookLeadConfig.findOne({}).select("+pageAccessToken");
      assert.equal(afterDisconnect.isConnected, false);
      assert.equal(Boolean(afterDisconnect.pageAccessToken), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
