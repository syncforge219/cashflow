import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import dbConnect from "@/lib/db";
import { getUserFromCookies } from "@/lib/helper";
import { loadFacebookConfig, buildFacebookOAuthUrl } from "@/lib/facebookLeads";
import { encryptField } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const actor: any = await getUserFromCookies();

    const returnUrl = req.nextUrl.searchParams.get("returnUrl") || "/marketing-dashboard?tab=connectors";

    const config = await loadFacebookConfig();

    if (!config.appId) {
      const errUrl = new URL(returnUrl, req.url);
      errUrl.searchParams.set("fb_error", "Meta App ID is missing. Please configure it in the connector settings.");
      errUrl.searchParams.set("fb_modal", "true");
      return NextResponse.redirect(errUrl);
    }

    if (!config.appSecret) {
      const errUrl = new URL(returnUrl, req.url);
      errUrl.searchParams.set(
        "fb_error",
        "Meta App Secret is missing. Please save your App Secret before connecting."
      );
      errUrl.searchParams.set("fb_modal", "true");
      return NextResponse.redirect(errUrl);
    }

    // Determine public origin
    const forwardedProto = req.headers.get("x-forwarded-proto") || "http";
    const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const origin =
      process.env.PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (forwardedHost ? `${forwardedProto}://${forwardedHost}` : req.nextUrl.origin);

    const statePayload = JSON.stringify({
      nonce: crypto.randomBytes(16).toString("hex"),
      userId: actor?._id ? String(actor._id) : "",
      userName: actor?.name || "",
      userRole: actor?.role || "",
      returnUrl,
      timestamp: Date.now(),
    });

    const encryptedState = encryptField(statePayload) || Buffer.from(statePayload).toString("base64");

    const oauthUrl = buildFacebookOAuthUrl(
      origin,
      encryptedState,
      config.appId,
      config.graphApiVersion || "v22.0"
    );

    return NextResponse.redirect(oauthUrl);
  } catch (error: any) {
    console.error("[Facebook OAuth Init] Error:", error);
    const returnUrl = req.nextUrl.searchParams.get("returnUrl") || "/marketing-dashboard?tab=connectors";
    const errUrl = new URL(returnUrl, req.url);
    errUrl.searchParams.set("fb_error", error.message || "Failed to initiate Facebook OAuth");
    return NextResponse.redirect(errUrl);
  }
}
