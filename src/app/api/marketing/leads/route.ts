import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import User from "@/models/User";
import { POST as createEnquiry } from "@/app/api/enquiries/route";
import { getMarketingScope, periodFromQuery } from "@/lib/marketingScope";

/** The only lead fields a marketing user sees: contact + source info, no counselling/fee data. */
const VISIBLE_FIELDS =
  "enquiryId studentFullName primaryPhoneMobile emailAddress currentCity targetBrand targetCourse leadSource utmCampaign date createdAt status isAdmitted addedByName";

const toVisible = (e: any) => ({
  _id: String(e._id),
  enquiryId: e.enquiryId || "",
  name: e.studentFullName || "",
  phone: e.primaryPhoneMobile || "",
  email: e.emailAddress || "",
  city: e.currentCity || "",
  brand: e.targetBrand || "",
  course: e.targetCourse || "",
  source: e.leadSource || "",
  campaign: e.utmCampaign || "",
  date: e.date || "",
  createdAt: e.createdAt,
  converted: Boolean(e.isAdmitted) || ["admitted", "admission", "converted"].includes(String(e.status || "").toLowerCase()),
  addedBy: e.addedByName || "",
});

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { scope, error } = await getMarketingScope(req);
    if (error) return error;

    const { start, end } = periodFromQuery(req);
    const params = new URL(req.url).searchParams;
    const query: any = { addedByUserId: { $in: scope!.userIds }, createdAt: { $gte: start, $lte: end } };
    const source = params.get("source");
    if (source && source !== "all") query.leadSource = { $regex: new RegExp(`^${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") };

    const leads = await Enquiry.find(query).select(VISIBLE_FIELDS).sort({ createdAt: -1 }).limit(1000).lean();
    return NextResponse.json({ success: true, data: leads.map(toVisible), truncated: leads.length === 1000 });
  } catch (err: any) {
    console.error("[marketing/leads GET]", err);
    return NextResponse.json({ success: false, error: "Failed to load leads" }, { status: 500 });
  }
}

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { error } = await getMarketingScope(req);
    if (error) return error;

    const body = await req.json().catch(() => ({}));

    const name = str(body.name, 120);
    if (!name) return NextResponse.json({ success: false, error: "Name is required." }, { status: 400 });
    const digits = str(body.phone, 20).replace(/\D/g, "");
    const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.slice(-10);
    if (ten.length !== 10) return NextResponse.json({ success: false, error: "Enter a valid 10-digit mobile number." }, { status: 400 });
    const source = str(body.source, 80);
    if (!source) return NextResponse.json({ success: false, error: "Lead source is required." }, { status: 400 });

    // Only an existing counsellor (or nobody) can be assigned
    let advisor = "Unassigned";
    const wantedAdvisor = str(body.counsellor, 120);
    if (wantedAdvisor) {
      const exists = await User.exists({ name: wantedAdvisor, role: { $in: ["counsellor", "counselor"] } });
      if (exists) advisor = wantedAdvisor;
    }

    const courses = (Array.isArray(body.courses) ? body.courses : [body.course])
      .map((c: unknown) => str(c, 120))
      .filter(Boolean)
      .slice(0, 5);

    // Whitelisted fields only (no status, fees, admission flags...); everything else is decided by the
    // normal enquiry pipeline: duplicate check, student record, follow-up task, WhatsApp alerts.
    const payload = {
      studentFullName: name,
      primaryPhoneMobile: `+91 ${ten}`,
      emailAddress: str(body.email, 120),
      currentCity: str(body.city, 80),
      targetBrand: str(body.brand, 80) || undefined,
      courses: courses.length ? courses : undefined,
      leadSource: source,
      utmSource: "marketing",
      utmMedium: "manual_entry",
      utmCampaign: str(body.campaign, 120),
      remarks: str(body.notes, 1000),
      assignedCrmAdvisor: advisor,
      status: "New",
      leadTags: ["Marketing"],
    };

    const res = await createEnquiry(
      new Request(new URL("/api/enquiries", req.url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    );
    const result = await res.json();
    if (!res.ok || !result.success) {
      return NextResponse.json({ success: false, error: result.message || "Could not add the lead." }, { status: res.status || 400 });
    }

    return NextResponse.json({ success: true, data: toVisible(result.data), message: "Lead added." }, { status: 201 });
  } catch (err: any) {
    console.error("[marketing/leads POST]", err);
    return NextResponse.json({ success: false, error: "Failed to add the lead" }, { status: 500 });
  }
}
