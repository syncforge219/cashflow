import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import FacebookLeadConfig from "@/models/FacebookLeadConfig";
import FacebookLeadLog from "@/models/FacebookLeadLog";
import { loadFacebookConfig, graphRequest } from "@/lib/facebookLeads";

export async function POST() {
  try {
    await dbConnect();
    const config = await loadFacebookConfig();

    // Best-effort attempt to unsubscribe from Meta webhooks
    if (config.pageId && config.pageAccessToken) {
      try {
        await graphRequest(
          `${config.pageId}/subscribed_apps`,
          config.pageAccessToken,
          config.graphApiVersion || "v22.0",
          {},
          "POST"
        );
      } catch (err: any) {
        console.warn("[Facebook Disconnect] Could not unsubscribe app:", err.message);
      }
    }

    const doc: any = await FacebookLeadConfig.findOne({});
    if (doc) {
      doc.isConnected = false;
      doc.connectedAt = null;
      doc.pageAccessToken = "";
      doc.userAccessToken = "";
      doc.connectedUserMetaId = "";
      doc.connectedUserMetaName = "";
      doc.availablePages = [];
      doc.encryptedPagesData = "";
      await doc.save();
    }

    await FacebookLeadLog.create({
      sourceType: "WEBHOOK",
      status: "SUCCESS",
      leadgenId: "oauth-disconnected",
      responseMessage: "Facebook account disconnected by user.",
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Facebook account disconnected successfully.",
    });
  } catch (error: any) {
    console.error("[Facebook Disconnect] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to disconnect Facebook account" },
      { status: 500 }
    );
  }
}
