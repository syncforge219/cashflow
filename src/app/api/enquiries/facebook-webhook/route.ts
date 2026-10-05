import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import dbConnect from "@/lib/db";
import {
  loadFacebookConfig,
  fetchLeadById,
  ingestFacebookLead,
  isValidMetaSignature,
  logFacebookFailure,
} from "@/lib/facebookLeads";

/**
 * Meta webhook verification handshake.
 * Meta calls: GET ?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<n>
 * and expects the challenge echoed back as plain text.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token") || "";
  const challenge = params.get("hub.challenge") || "";

  try {
    await dbConnect();
    const config = await loadFacebookConfig();
    const expected = String(config.verifyToken || "");

    const tokenMatches =
      expected.length > 0 &&
      token.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));

    if (mode === "subscribe" && tokenMatches) {
      return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new NextResponse("Verification failed", { status: 403 });
  } catch (error: any) {
    console.error("[Facebook Webhook] Verification error:", error);
    return new NextResponse("Server error", { status: 500 });
  }
}

/**
 * Lead notifications. Payload shape:
 * { object: "page", entry: [{ id: pageId, changes: [{ field: "leadgen", value: { leadgen_id, form_id, page_id, ... } }] }] }
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  try {
    await dbConnect();
    const config = await loadFacebookConfig();

    // Signature check (required once the App Secret is saved)
    if (config.appSecret) {
      const signature = req.headers.get("x-hub-signature-256");
      if (!isValidMetaSignature(rawBody, signature, config.appSecret)) {
        await logFacebookFailure(
          "WEBHOOK",
          { rawPayload: { body: rawBody.slice(0, 2000) } },
          signature ? "X-Hub-Signature-256 did not match the configured App Secret." : "Missing X-Hub-Signature-256 header.",
          "UNAUTHORIZED"
        );
        return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
      }
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: "Body must be JSON" }, { status: 400 });
    }

    if (payload?.object !== "page" || !Array.isArray(payload.entry)) {
      // Not a Page/leadgen notification; acknowledge so Meta does not retry
      return NextResponse.json({ success: true, ignored: true });
    }

    const results: any[] = [];
    for (const entry of payload.entry) {
      for (const change of entry?.changes || []) {
        if (change?.field !== "leadgen") continue;
        const value = change.value || {};
        const leadgenId = String(value.leadgen_id || "");
        const pageId = String(value.page_id || entry.id || "");
        if (!leadgenId) continue;

        if (config.pageId && pageId && pageId !== config.pageId) {
          await logFacebookFailure(
            "WEBHOOK",
            { leadgenId, pageId, formId: value.form_id, rawPayload: value },
            `Lead belongs to page ${pageId}, but the connector is configured for page ${config.pageId}.`
          );
          results.push({ leadgenId, status: "IGNORED_OTHER_PAGE" });
          continue;
        }

        try {
          const lead = await fetchLeadById(leadgenId, config);
          // Webhook values are authoritative if the Graph response omits them
          lead.form_id = lead.form_id || value.form_id;
          lead.ad_id = lead.ad_id || value.ad_id;
          const result = await ingestFacebookLead(lead, config, { sourceType: "WEBHOOK", pageId });
          results.push({ leadgenId, ...result });
        } catch (err: any) {
          console.error(`[Facebook Webhook] Lead ${leadgenId} failed:`, err);
          await logFacebookFailure(
            "WEBHOOK",
            { leadgenId, pageId, formId: value.form_id, rawPayload: value },
            err?.message || "Unknown error"
          );
          results.push({ leadgenId, status: "FAILED", error: err?.message });
        }
      }
    }

    // Always 200: failed leads are logged and can be recovered with "Pull Sync" (idempotent),
    // whereas a non-200 makes Meta redeliver the whole batch for hours.
    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (error: any) {
    console.error("[Facebook Webhook] Error:", error);
    // Infrastructure failure (e.g. DB down): let Meta retry later
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
