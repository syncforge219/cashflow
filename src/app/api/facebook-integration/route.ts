import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import FacebookLeadConfig from "@/models/FacebookLeadConfig";
import FacebookLeadLog from "@/models/FacebookLeadLog";
import { loadFacebookConfig, generateVerifyToken } from "@/lib/facebookLeads";

const EDITABLE_FIELDS = [
  "pageId",
  "pageName",
  "graphApiVersion",
  "verifyToken",
  "leadSource",
  "leadStage",
  "defaultBrand",
  "counselorName",
  "defaultCourse",
  "sendWelcomeWhatsApp",
  "sendAdminAlertWhatsApp",
  "createFollowUpTask",
  "formMappings",
] as const;

const BOOLEAN_FIELDS = new Set<string>(["sendWelcomeWhatsApp", "sendAdminAlertWhatsApp", "createFollowUpTask"]);

/** Config for the settings screen. Secrets are never returned, only whether they are set. */
export async function GET() {
  try {
    await dbConnect();
    const { appSecret, pageAccessToken, ...config } = await loadFacebookConfig();

    const [totalLogsCount, successLogsCount, failedLogsCount] = await Promise.all([
      FacebookLeadLog.countDocuments({}),
      FacebookLeadLog.countDocuments({ status: "SUCCESS" }),
      FacebookLeadLog.countDocuments({ status: "FAILED" }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        hasAppSecret: Boolean(appSecret),
        hasPageAccessToken: Boolean(pageAccessToken),
        stats: {
          totalLeadsReceived: config.totalLeadsReceived || 0,
          lastLeadReceivedAt: config.lastLeadReceivedAt || null,
          lastSyncAt: config.lastSyncAt || null,
          totalLogsCount,
          successLogsCount,
          failedLogsCount,
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching Facebook config:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to load config" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    await loadFacebookConfig(); // creates the default document on first use

    const config: any = await FacebookLeadConfig.findOne({});

    for (const field of EDITABLE_FIELDS) {
      if (body[field] === undefined) continue;
      if (field === "formMappings") {
        config.formMappings = (Array.isArray(body.formMappings) ? body.formMappings : [])
          .filter((m: any) => m && String(m.formId || "").trim())
          .map((m: any) => ({
            formId: String(m.formId).trim(),
            formName: String(m.formName || "").trim(),
            course: String(m.course || "").trim(),
            brand: String(m.brand || "").trim(),
            counselorName: String(m.counselorName || "").trim(),
          }));
      } else if (BOOLEAN_FIELDS.has(field)) {
        config[field] = Boolean(body[field]);
      } else {
        config[field] = String(body[field] ?? "").trim();
      }
    }

    if (!config.verifyToken) config.verifyToken = generateVerifyToken();

    // Blank secret = keep the stored value (the UI never receives secrets back)
    if (typeof body.appSecret === "string" && body.appSecret.trim()) config.appSecret = body.appSecret.trim();
    if (typeof body.pageAccessToken === "string" && body.pageAccessToken.trim()) {
      config.pageAccessToken = body.pageAccessToken.trim();
    }
    if (body.clearAppSecret === true) config.appSecret = "";
    if (body.clearPageAccessToken === true) config.pageAccessToken = "";

    await config.save();

    return NextResponse.json({ success: true, message: "Facebook Lead Ads connector saved." });
  } catch (error: any) {
    console.error("Error saving Facebook config:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to save config" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await dbConnect();
    await FacebookLeadConfig.deleteMany({});
    return NextResponse.json({ success: true, message: "Facebook connector configuration reset." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
