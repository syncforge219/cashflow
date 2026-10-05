import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import FacebookLeadConfig from "@/models/FacebookLeadConfig";
import { loadFacebookConfig, graphRequest } from "@/lib/facebookLeads";

/**
 * GET  -> checks the saved Page token and lists the page's Lead Ads forms (for mapping).
 * POST -> subscribes the page to this app's "leadgen" webhook so new leads are pushed to us.
 */
async function requireCredentials() {
  const config = await loadFacebookConfig();
  if (!config.pageAccessToken || !config.pageId) {
    return { config, error: "Save the Page ID and Page Access Token first." };
  }
  return { config, error: null };
}

export async function GET() {
  try {
    await dbConnect();
    const { config, error } = await requireCredentials();
    if (error) return NextResponse.json({ success: false, error }, { status: 400 });

    const v = config.graphApiVersion;
    const [page, forms, subscriptions] = await Promise.all([
      graphRequest(config.pageId, config.pageAccessToken, v, { fields: "id,name" }),
      graphRequest(`${config.pageId}/leadgen_forms`, config.pageAccessToken, v, {
        fields: "id,name,status,leads_count,created_time",
        limit: "100",
      }),
      graphRequest(`${config.pageId}/subscribed_apps`, config.pageAccessToken, v).catch(() => ({ data: [] })),
    ]);

    const leadgenSubscribed = (subscriptions.data || []).some((app: any) =>
      (app.subscribed_fields || []).includes("leadgen")
    );

    if (page?.name && page.name !== config.pageName) {
      await FacebookLeadConfig.updateOne({}, { $set: { pageName: page.name } });
    }

    return NextResponse.json({
      success: true,
      page: { id: page.id, name: page.name },
      leadgenSubscribed,
      forms: (forms.data || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        status: f.status,
        leadsCount: f.leads_count,
        createdTime: f.created_time,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Connection check failed" }, { status: 502 });
  }
}

export async function POST() {
  try {
    await dbConnect();
    const { config, error } = await requireCredentials();
    if (error) return NextResponse.json({ success: false, error }, { status: 400 });

    const result = await graphRequest(
      `${config.pageId}/subscribed_apps`,
      config.pageAccessToken,
      config.graphApiVersion,
      { subscribed_fields: "leadgen" },
      "POST"
    );

    return NextResponse.json({
      success: Boolean(result?.success),
      message: result?.success
        ? "Page subscribed to lead notifications. New leads will now arrive automatically."
        : "Meta did not confirm the subscription.",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Subscription failed" }, { status: 502 });
  }
}
