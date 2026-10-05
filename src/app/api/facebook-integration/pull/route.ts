import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import FacebookLeadConfig from "@/models/FacebookLeadConfig";
import {
  loadFacebookConfig,
  graphRequest,
  graphFetch,
  ingestFacebookLead,
  logFacebookFailure,
  LEAD_FIELDS,
  type FacebookLead,
} from "@/lib/facebookLeads";

const MAX_LEADS_PER_SYNC = 1000;

/**
 * Pulls leads straight from the Graph API (GET /{form_id}/leads).
 * Use it to backfill leads from before the webhook was connected, or to recover leads whose
 * webhook delivery failed. Safe to run repeatedly: already-imported lead IDs are skipped.
 *
 * Body: { formIds?: string[], since?: "YYYY-MM-DD" }  (defaults: all mapped forms, last 7 days)
 */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json().catch(() => ({}));
    const config = await loadFacebookConfig();

    if (!config.pageAccessToken) {
      return NextResponse.json(
        { success: false, error: "Save a Page Access Token in Connection Settings first." },
        { status: 400 }
      );
    }

    let formIds: string[] = Array.isArray(body.formIds)
      ? body.formIds.map((f: any) => String(f).trim()).filter(Boolean)
      : (config.formMappings || []).map((m: any) => m.formId).filter(Boolean);

    // No forms mapped: pull from every form on the page
    if (formIds.length === 0) {
      if (!config.pageId) {
        return NextResponse.json(
          { success: false, error: "Add a Page ID or at least one form mapping before pulling leads." },
          { status: 400 }
        );
      }
      const forms = await graphRequest(`${config.pageId}/leadgen_forms`, config.pageAccessToken, config.graphApiVersion, {
        fields: "id",
        limit: "100",
      });
      formIds = (forms.data || []).map((f: any) => f.id);
    }

    const sinceDate = body.since ? new Date(body.since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(sinceDate.getTime())) {
      return NextResponse.json({ success: false, error: "Invalid 'since' date." }, { status: 400 });
    }
    const filtering = JSON.stringify([
      { field: "time_created", operator: "GREATER_THAN", value: Math.floor(sinceDate.getTime() / 1000) },
    ]);

    let fetched = 0;
    let imported = 0;
    let duplicates = 0;
    let failed = 0;
    const formErrors: { formId: string; error: string }[] = [];

    for (const formId of formIds) {
      try {
        let page = await graphRequest(`${formId}/leads`, config.pageAccessToken, config.graphApiVersion, {
          fields: LEAD_FIELDS,
          filtering,
          limit: "100",
        });

        while (page && fetched < MAX_LEADS_PER_SYNC) {
          for (const lead of (page.data || []) as FacebookLead[]) {
            if (fetched >= MAX_LEADS_PER_SYNC) break;
            fetched++;
            lead.form_id = lead.form_id || formId;
            try {
              const result = await ingestFacebookLead(lead, config, { sourceType: "PULL_SYNC" });
              if (result.status === "SUCCESS") imported++;
              else duplicates++;
            } catch (err: any) {
              failed++;
              await logFacebookFailure(
                "PULL_SYNC",
                { leadgenId: lead.id, formId, rawPayload: lead },
                err?.message || "Unknown error"
              );
            }
          }
          page = page.paging?.next && fetched < MAX_LEADS_PER_SYNC ? await graphFetch(page.paging.next) : null;
        }
      } catch (err: any) {
        formErrors.push({ formId, error: err?.message || "Unknown error" });
      }
    }

    await FacebookLeadConfig.updateOne({}, { $set: { lastSyncAt: new Date() } });

    const allFormsFailed = formIds.length > 0 && formErrors.length === formIds.length;
    return NextResponse.json(
      {
        success: !allFormsFailed,
        message: allFormsFailed
          ? `Could not read leads from any form: ${formErrors[0].error}`
          : `Pull sync finished. Imported ${imported}, already imported ${duplicates}, failed ${failed} (fetched ${fetched} from ${formIds.length} form${formIds.length === 1 ? "" : "s"}).`,
        formsChecked: formIds.length,
        fetched,
        imported,
        duplicates,
        failed,
        formErrors,
        limitReached: fetched >= MAX_LEADS_PER_SYNC,
      },
      { status: allFormsFailed ? 502 : 200 }
    );
  } catch (error: any) {
    console.error("Facebook pull sync error:", error);
    return NextResponse.json({ success: false, error: error.message || "Pull sync failed" }, { status: 500 });
  }
}
