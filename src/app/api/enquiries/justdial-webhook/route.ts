import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import JustdialConfig from "@/models/JustdialConfig";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();

    const config = await JustdialConfig.findOne({}).lean();

    // Extract fields from standard Justdial Lead payload
    const studentFullName = body.name || body.studentFullName || body.lead_name || "Justdial Inquiry";
    const primaryPhoneMobile = body.mobile || body.phone || body.primaryPhoneMobile || body.lead_mobile || "";
    const emailAddress = body.email || body.emailAddress || body.lead_email || "";
    const currentCity = body.city || body.location || "";
    const justdialCategory = body.category || body.product || body.course || "";
    const remarks = body.area || body.address || body.query || body.message || `Incoming Justdial Lead. Category: ${justdialCategory}`;

    // Find course mapping
    let matchedCourse = config?.defaultCourse || "";
    let matchedCounselor = config?.counselorName || "Unassigned CRM Advisor";

    if (justdialCategory && config?.courseMappings && config.courseMappings.length > 0) {
      const mapping = config.courseMappings.find(
        (m: any) => m.justdialCategory.toLowerCase().trim() === justdialCategory.toLowerCase().trim()
      );
      if (mapping) {
        matchedCourse = mapping.course;
        if (mapping.counselorName) matchedCounselor = mapping.counselorName;
      }
    }

    // Auto-generate unique Enquiry ID
    const year = new Date().getFullYear();
    const count = await Enquiry.countDocuments({});
    const enquiryId = `JD-${year}-${String(count + 1).padStart(4, "0")}`;

    const newEnquiry: any = await Enquiry.create({
      enquiryId,
      studentFullName,
      primaryPhoneMobile,
      emailAddress,
      currentCity,
      leadSource: config?.leadSource || "JustDial",
      status: config?.leadStage || "New / Fresh Inquiry",
      assignedCrmAdvisor: matchedCounselor,
      targetCourse: matchedCourse,
      remarks,
      date: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Justdial Lead captured and registered successfully",
      enquiryId: newEnquiry.enquiryId,
      lead: newEnquiry,
    });
  } catch (error: any) {
    console.error("Error processing Justdial Webhook lead:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process Justdial lead webhook" },
      { status: 500 }
    );
  }
}
