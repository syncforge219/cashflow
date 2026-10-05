import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Brand from "@/models/Brand";
import Course from "@/models/Course";
import LeadSource from "@/models/LeadSource";
import User from "@/models/User";
import { getMarketingScope } from "@/lib/marketingScope";

/**
 * Names only, for the marketing forms and connector set-up screens.
 * (/api/brands and /api/counsellors return revenue, phone numbers etc. and stay blocked.)
 */
export async function GET(req: Request) {
  try {
    await dbConnect();
    const { scope, error } = await getMarketingScope(req);
    if (error) return error;

    const [brands, courses, sources, counsellors, marketingUsers] = await Promise.all([
      Brand.find({ status: { $ne: "INACTIVE" } }).select("name").lean(),
      Course.find({ status: { $ne: "INACTIVE" } }).select("name").lean(),
      LeadSource.find({}).select("name sourceName").lean(),
      User.find({ role: { $in: ["counsellor", "counselor"] } }).select("name").lean(),
      scope!.isAdmin ? User.find({ role: { $regex: /^marketing[\s_-]*executive$/i } }).select("name email").lean() : [],
    ]);

    const uniqueSorted = (list: any[]) =>
      Array.from(new Set(list.map((x) => String(x || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      success: true,
      data: {
        brands: uniqueSorted(brands.map((b: any) => (b.name || "").toUpperCase())),
        courses: uniqueSorted(courses.map((c: any) => c.name)),
        leadSources: uniqueSorted([
          ...sources.map((s: any) => s.name || s.sourceName),
          "Meta Ads",
          "Google Ads",
          "JustDial",
          "Website",
          "Instagram",
          "Hoarding",
          "Newspaper",
          "Seminar",
        ]),
        counsellors: uniqueSorted(counsellors.map((c: any) => c.name)),
        marketingUsers: (marketingUsers as any[]).map((u) => ({ id: String(u._id), name: u.name || u.email })),
        isAdmin: scope!.isAdmin,
      },
    });
  } catch (err: any) {
    console.error("[marketing/lookups]", err);
    return NextResponse.json({ success: false, error: "Failed to load lists" }, { status: 500 });
  }
}
