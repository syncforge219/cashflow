import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import LeadSource from "@/models/LeadSource";
import Enquiry from "@/models/Enquiry";

const DEFAULT_LEAD_SOURCES = [
  "Google Ads",
  "Meta Ads",
  "Website",
  "Seminar",
  "Hoarding",
  "Reference",
  "Paper Ads",
  "Internet Search",
  "Direct Walkin",
  "Call on Database",
];

export async function GET() {
  try {
    await dbConnect();

    let sources = await LeadSource.find().sort({ name: 1 }).lean();

    // Auto-seed default lead sources if database collection is empty
    if (!sources || sources.length === 0) {
      const seedDocs = DEFAULT_LEAD_SOURCES.map((name) => ({ name, isSystem: true }));
      await LeadSource.insertMany(seedDocs, { ordered: false }).catch(() => {});
      sources = await LeadSource.find().sort({ name: 1 }).lean();
    }

    // Also auto-sync any unique lead sources existing in Enquiry collection
    try {
      const existingEnquirySources = await Enquiry.distinct("leadSource");
      const currentNamesLower = new Set(sources.map((s: any) => s.name.toLowerCase().trim()));

      const missingSources: string[] = [];
      for (const src of existingEnquirySources) {
        if (src && typeof src === "string" && src.trim()) {
          const cleanSrc = src.trim();
          if (!currentNamesLower.has(cleanSrc.toLowerCase())) {
            missingSources.push(cleanSrc);
            currentNamesLower.add(cleanSrc.toLowerCase());
          }
        }
      }

      if (missingSources.length > 0) {
        await LeadSource.insertMany(
          missingSources.map((name) => ({ name, isSystem: false })),
          { ordered: false }
        ).catch(() => {});
        sources = await LeadSource.find().sort({ name: 1 }).lean();
      }
    } catch (syncErr) {
      console.warn("Could not sync enquiry lead sources:", syncErr);
    }

    return NextResponse.json({ success: true, data: sources });
  } catch (error: any) {
    console.error("GET /api/lead-sources error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch lead sources" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();

    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { success: false, message: "Lead source name is required" },
        { status: 400 }
      );
    }

    // Case-insensitive duplicate check
    const existing = await LeadSource.findOne({
      name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });

    if (existing) {
      return NextResponse.json(
        { success: true, data: existing, message: "Lead source already exists" },
        { status: 200 }
      );
    }

    const newSource = await LeadSource.create({ name });
    return NextResponse.json({ success: true, data: newSource }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/lead-sources error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to add lead source" },
      { status: 500 }
    );
  }
}
