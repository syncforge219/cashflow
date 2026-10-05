import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { loadFacebookConfig, ingestFacebookLead } from "@/lib/facebookLeads";

/**
 * Runs a fake lead through the real ingestion pipeline (no Meta call), so routing,
 * enquiry creation and task creation can be checked from the settings screen.
 */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json().catch(() => ({}));
    const config = await loadFacebookConfig();

    const str = (v: any, fallback: string) => (typeof v === "string" && v.trim() ? v.trim() : fallback);

    const lead = {
      id: `TEST-${Date.now()}`,
      created_time: new Date().toISOString(),
      form_id: str(body.formId, ""),
      campaign_name: str(body.campaignName, "Test Campaign"),
      ad_name: "Simulated Ad",
      platform: body.platform === "ig" ? "ig" : "fb",
      is_organic: false,
      field_data: [
        { name: "full_name", values: [str(body.name, "Test Facebook Lead")] },
        { name: "phone_number", values: [str(body.phone, "+919876543210")] },
        { name: "email", values: [str(body.email, "test.facebook@example.com")] },
        { name: "city", values: [str(body.city, "Lucknow")] },
        ...(body.course ? [{ name: "which_course_are_you_interested_in?", values: [String(body.course)] }] : []),
      ],
    };

    const result = await ingestFacebookLead(lead, config, {
      sourceType: "SIMULATION_TEST",
      sendWhatsApp: body.sendLiveWhatsApp === true,
    });

    return NextResponse.json({ success: true, ...result, leadgenId: lead.id });
  } catch (error: any) {
    console.error("Facebook test lead error:", error);
    return NextResponse.json({ success: false, error: error.message || "Test lead failed" }, { status: 500 });
  }
}
