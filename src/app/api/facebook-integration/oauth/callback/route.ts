import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import FacebookLeadConfig from "@/models/FacebookLeadConfig";
import FacebookLeadLog from "@/models/FacebookLeadLog";
import {
  loadFacebookConfig,
  exchangeCodeForUserToken,
  exchangeForLongLivedUserToken,
  fetchMetaUserProfile,
  fetchUserManagedPages,
  graphRequest,
} from "@/lib/facebookLeads";
import { decryptField, encryptJson } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  let returnUrl = "/marketing-dashboard?tab=connectors";

  try {
    await dbConnect();

    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const fbError = searchParams.get("error");
    const fbErrorDesc = searchParams.get("error_description") || searchParams.get("error_reason");

    // Attempt to recover state and returnUrl
    let stateData: any = {};
    if (state) {
      try {
        const decrypted = decryptField(state);
        const jsonStr = decrypted || (state.startsWith("{") ? state : Buffer.from(state, "base64").toString("utf8"));
        stateData = JSON.parse(jsonStr);
        if (stateData.returnUrl) returnUrl = stateData.returnUrl;
      } catch (err) {
        console.warn("[Facebook OAuth Callback] Could not parse state:", err);
      }
    }

    // Handle user cancellation / OAuth denial
    if (fbError || !code) {
      const message = fbErrorDesc || fbError || "Facebook authorization was cancelled or failed.";
      console.warn("[Facebook OAuth Callback] Denied / Error:", message);

      await FacebookLeadLog.create({
        sourceType: "WEBHOOK",
        status: "FAILED",
        leadgenId: "oauth-error",
        responseMessage: `Facebook authorization failed: ${message}`,
      }).catch(() => {});

      const redirectTarget = new URL(returnUrl, req.url);
      redirectTarget.searchParams.set("fb_error", message);
      return NextResponse.redirect(redirectTarget);
    }

    const config = await loadFacebookConfig();
    if (!config.appId || !config.appSecret) {
      throw new Error("Meta App ID or App Secret is not configured.");
    }

    const forwardedProto = req.headers.get("x-forwarded-proto") || "http";
    const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const origin =
      process.env.PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (forwardedHost ? `${forwardedProto}://${forwardedHost}` : req.nextUrl.origin);

    const redirectUri = `${origin.replace(/\/+$/, "")}/api/facebook-integration/oauth/callback`;
    const version = config.graphApiVersion || "v22.0";

    // 1. Exchange code for short-lived user access token
    const { accessToken: shortUserToken } = await exchangeCodeForUserToken(
      code,
      redirectUri,
      config.appId,
      config.appSecret,
      version
    );

    // 2. Exchange for 60-day long-lived user access token
    const { accessToken: longUserToken } = await exchangeForLongLivedUserToken(
      shortUserToken,
      config.appId,
      config.appSecret,
      version
    );

    // 3. Fetch Meta user identity
    const profile = await fetchMetaUserProfile(longUserToken, version).catch(() => ({
      id: "",
      name: "Meta User",
    }));

    // 4. Fetch managed Facebook Pages with never-expiring Page Access Tokens
    const pages = await fetchUserManagedPages(longUserToken, version);

    const dbDoc: any = await FacebookLeadConfig.findOne({});
    if (!dbDoc) {
      throw new Error("Facebook configuration record not found in database.");
    }

    dbDoc.isConnected = true;
    dbDoc.connectedAt = new Date();
    dbDoc.connectedUserMetaId = profile.id || "";
    dbDoc.connectedUserMetaName = profile.name || "";
    dbDoc.userAccessToken = longUserToken;

    if (stateData.userId) {
      dbDoc.connectedByUserId = stateData.userId;
      dbDoc.connectedByName = stateData.userName || "";
    }

    if (!pages || pages.length === 0) {
      dbDoc.availablePages = [];
      dbDoc.encryptedPagesData = "";
      await dbDoc.save();

      const redirectTarget = new URL(returnUrl, req.url);
      redirectTarget.searchParams.set("fb_connected", "true");
      redirectTarget.searchParams.set(
        "fb_warning",
        "Connected to Facebook, but no business Pages were found. Ensure you are an Admin or Manager of a Facebook Page."
      );
      return NextResponse.redirect(redirectTarget);
    }

    // Pick primary page (either existing matching page or first page)
    const existingIndex = pages.findIndex((p: any) => p.id === dbDoc.pageId);
    const primaryPage = existingIndex >= 0 ? pages[existingIndex] : pages[0];

    dbDoc.pageId = primaryPage.id;
    dbDoc.pageName = primaryPage.name;
    dbDoc.pageAccessToken = primaryPage.access_token;
    dbDoc.availablePages = pages.map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category || "",
    }));
    dbDoc.encryptedPagesData = encryptJson(
      pages.map((p: any) => ({
        id: p.id,
        name: p.name,
        access_token: p.access_token,
        category: p.category || "",
      }))
    );

    await dbDoc.save();

    // Auto-subscribe the selected page to leadgen webhook notifications
    let leadgenSubscribed = false;
    try {
      const subResult = await graphRequest(
        `${primaryPage.id}/subscribed_apps`,
        primaryPage.access_token,
        version,
        { subscribed_fields: "leadgen" },
        "POST"
      );
      leadgenSubscribed = Boolean(subResult?.success);
    } catch (subErr: any) {
      console.warn("[Facebook OAuth] Auto-subscription warning:", subErr.message);
    }

    // Log connection event
    await FacebookLeadLog.create({
      sourceType: "WEBHOOK",
      status: "SUCCESS",
      leadgenId: `oauth-connected-${primaryPage.id}`,
      pageId: primaryPage.id,
      responseMessage: `Successfully connected Facebook account "${profile.name}" and Page "${primaryPage.name}" (${primaryPage.id}). Webhook leadgen subscribed: ${leadgenSubscribed}`,
    }).catch(() => {});

    const redirectTarget = new URL(returnUrl, req.url);
    redirectTarget.searchParams.set("fb_connected", "true");
    redirectTarget.searchParams.set("fb_page", primaryPage.name);
    redirectTarget.searchParams.set("fb_pages_count", String(pages.length));

    return NextResponse.redirect(redirectTarget);
  } catch (error: any) {
    console.error("[Facebook OAuth Callback] Failure:", error);
    const redirectTarget = new URL(returnUrl, req.url);
    redirectTarget.searchParams.set("fb_error", error.message || "Failed to complete Facebook OAuth connection.");
    return NextResponse.redirect(redirectTarget);
  }
}
