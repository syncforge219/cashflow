import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import FacebookLeadConfig from "@/models/FacebookLeadConfig";
import { loadFacebookConfig, graphRequest } from "@/lib/facebookLeads";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { pageId } = await req.json();

    if (!pageId) {
      return NextResponse.json({ success: false, error: "pageId is required" }, { status: 400 });
    }

    const config = await loadFacebookConfig();
    const pages: any[] = config.availablePagesWithTokens || [];

    const targetPage = pages.find((p: any) => p.id === pageId);
    if (!targetPage) {
      return NextResponse.json(
        { success: false, error: "Selected page was not found in your connected Facebook account." },
        { status: 404 }
      );
    }

    const doc: any = await FacebookLeadConfig.findOne({});
    if (!doc) {
      return NextResponse.json({ success: false, error: "Config not found" }, { status: 404 });
    }

    doc.pageId = targetPage.id;
    doc.pageName = targetPage.name;
    doc.pageAccessToken = targetPage.access_token;
    await doc.save();

    // Auto-subscribe the new page to leadgen
    let leadgenSubscribed = false;
    try {
      const subResult = await graphRequest(
        `${targetPage.id}/subscribed_apps`,
        targetPage.access_token,
        config.graphApiVersion || "v22.0",
        { subscribed_fields: "leadgen" },
        "POST"
      );
      leadgenSubscribed = Boolean(subResult?.success);
    } catch (err: any) {
      console.warn("[Facebook Select Page] Subscribed apps warning:", err.message);
    }

    return NextResponse.json({
      success: true,
      message: `Active page switched to "${targetPage.name}".`,
      page: {
        id: targetPage.id,
        name: targetPage.name,
      },
      leadgenSubscribed,
    });
  } catch (error: any) {
    console.error("[Facebook Select Page] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to switch active Facebook page" },
      { status: 500 }
    );
  }
}
