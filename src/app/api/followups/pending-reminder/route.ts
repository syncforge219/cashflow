import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { sendPendingFollowupsReminderEmail } from "@/lib/emailService";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    // Check user authentication
    const userRole = (user?.role || "").toLowerCase().trim();
    const isStaffOrAdmin =
      userRole.includes("admin") ||
      userRole.includes("super admin") ||
      userRole.includes("super_admin") ||
      userRole.includes("superadmin") ||
      userRole.includes("manager") ||
      userRole.includes("head") ||
      userRole.includes("cfo") ||
      userRole.includes("director");

    if (!user || !isStaffOrAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Centre Head or Administrative privileges required." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    let brand = body.brand || "All";
    const targetLeadIds = Array.isArray(body.targetLeadIds) ? body.targetLeadIds : undefined;

    // Strict user brand isolation: if user is restricted to specific brand(s), limit target brand
    const userScope = (user.brandScope || "").toLowerCase().trim();
    const isRestricted = Boolean(userScope && !["all", "all brands", "global", "*"].includes(userScope));
    const allowedBrands = isRestricted
      ? userScope.split(/[,/|]/).map((b) => b.trim().toLowerCase()).filter(Boolean)
      : [];

    if (isRestricted && allowedBrands.length > 0) {
      if (brand === "All" || brand === "All Brands") {
        brand = allowedBrands[0];
      } else {
        const matches = allowedBrands.some((ub) => ub === brand.toLowerCase().trim() || ub.includes(brand.toLowerCase().trim()));
        if (!matches) {
          return NextResponse.json(
            { success: false, error: `Unauthorized to send follow-up alerts outside your assigned brand scope (${allowedBrands.join(", ")}).` },
            { status: 403 }
          );
        }
      }
    }

    const senderName = `${user.name || "User"} (${user.role || "Staff"})`;
    const result = await sendPendingFollowupsReminderEmail({
      brand,
      targetLeadIds,
      triggeredBy: senderName,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API pending-reminder] Error sending pending followups email:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const user = await getAuthenticatedUser();

    const { searchParams } = new URL(req.url);
    const brandParam = searchParams.get("brand") || "All";

    const todayTime = new Date().setHours(0, 0, 0, 0);

    const query: any = {
      status: {
        $nin: [
          "Admitted", "admitted",
          "Lost", "lost",
          "Do not follow up", "do not follow up", "Do Not Followup", "Do Not Follow Up",
          "Completed", "completed",
          "Cancelled", "cancelled"
        ]
      }
    };

    if (brandParam && brandParam !== "All" && brandParam !== "All Brands") {
      const bRegex = new RegExp(`^${brandParam.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
      query.$or = [{ targetBrand: bRegex }, { brand: bRegex }];
    }

    const rawLeads = await Enquiry.find(query).select("enquiryId studentFullName targetBrand brand followUps nextFollowUpDate followUpDate assignedCrmAdvisor status").lean();

    let pendingCount = 0;
    const brandCounts: { [brand: string]: number } = {};

    for (const e of rawLeads as any[]) {
      const rawFollowups = Array.isArray(e.followUps) ? e.followUps : [];
      const isCompleted = (e.status || "").toLowerCase().includes("completed") || (rawFollowups.length > 0 && rawFollowups.every((f: any) => f.isCompleted || (f.status || "").toLowerCase() === "completed"));
      if (isCompleted) continue;

      const active = rawFollowups.filter((f: any) => !f.isCompleted && (f.status || "").toLowerCase() !== "completed" && (f.status || "").toLowerCase() !== "cancelled");
      let dStr = "";
      if (active.length > 0 && active[0].date) dStr = active[0].date;
      else if (e.nextFollowUpDate) dStr = e.nextFollowUpDate;
      else if (e.followUpDate) dStr = e.followUpDate;

      if (!dStr) continue;
      const dTime = new Date(dStr).getTime();
      if (isNaN(dTime) || dTime >= todayTime) continue;

      pendingCount++;
      const bName = (e.targetBrand || e.brand || "General").trim();
      brandCounts[bName] = (brandCounts[bName] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      totalPendingLeads: pendingCount,
      brandCounts,
      currentUserRole: user?.role,
      userBrandScope: user?.brandScope,
    });
  } catch (error: any) {
    console.error("[API pending-reminder] Error in preview GET:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
