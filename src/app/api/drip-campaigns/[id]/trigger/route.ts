import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import DripCampaign from "@/models/DripCampaign";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import { sendWhatsAppEnquiryWelcome } from "@/lib/msg91";

import mongoose from "mongoose";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { campaignId: id }] }
      : { campaignId: id };

    const campaign = await DripCampaign.findOne(query);
    if (!campaign) {
      return NextResponse.json({ success: false, message: "Drip campaign not found" }, { status: 404 });
    }

    // 1. Resolve Target Audience Leads from MongoDB
    let targetLeads: any[] = [];
    const isGlobalBrand = !campaign.brandScope || campaign.brandScope === "ALL BRANDS" || campaign.brandScope === "All Brands" || campaign.brandScope === "All";

    if (campaign.targetAudience === "Fee Pending Students") {
      let admissionQuery: any = { remainingBalance: { $gt: 0 } };
      if (!isGlobalBrand) {
        admissionQuery.$or = [
          { brand: { $regex: new RegExp(`^${campaign.brandScope.trim()}$`, "i") } },
          { brandName: { $regex: new RegExp(`^${campaign.brandScope.trim()}$`, "i") } }
        ];
      }
      const admissions = await Admission.find(admissionQuery).lean();
      targetLeads = admissions.map((a: any) => ({
        studentName: a.fullName || "Student",
        mobileNumber: a.mobileNumber || a.parentsPhoneNumber || "",
        courseName: a.course || "Program",
        brandName: a.brand || a.brandName || "CADD MANTRA",
        counsellorName: a.counsellor || "Academic Advisor",
      }));
    } else {
      let enquiryQuery: any = {};
      if (campaign.targetAudience === "Unconverted Leads") {
        enquiryQuery.status = { $nin: ["Admitted", "Joined", "Lost"] };
      } else if (campaign.targetAudience === "New Enquiries") {
        enquiryQuery.status = "New";
      }

      if (campaign.targetCourse && campaign.targetCourse !== "All Courses") {
        enquiryQuery.targetCourse = { $regex: new RegExp(`^${campaign.targetCourse}$`, "i") };
      }

      if (!isGlobalBrand) {
        enquiryQuery.targetBrand = { $regex: new RegExp(`^${campaign.brandScope.trim()}$`, "i") };
      }

      const enquiries = await Enquiry.find(enquiryQuery).lean();
      targetLeads = enquiries.map((e: any) => ({
        studentName: e.studentFullName || "Student",
        mobileNumber: e.primaryPhoneMobile || e.parentsPhoneNumber || "",
        courseName: e.targetCourse || "Program",
        brandName: e.targetBrand || "CADD MANTRA",
        counsellorName: e.assignedCrmAdvisor || "Academic Counsellor",
      }));
    }

    if (targetLeads.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No matching leads found for this campaign's target audience filters.",
        sentCount: 0,
      });
    }

    // 2. Dispatch Drip Messages to Target Audience
    let totalSent = 0;
    let stepCountUpdates = 0;

    for (const lead of targetLeads) {
      const mobile = lead.mobileNumber ? String(lead.mobileNumber).replace(/\D/g, "").slice(-10) : "";
      if (mobile && mobile.length === 10 && !mobile.startsWith("000000")) {
        // Send via WhatsApp helper
        try {
          await sendWhatsAppEnquiryWelcome({
            studentName: lead.studentName,
            mobileNumber: lead.mobileNumber,
            targetCourse: lead.courseName,
            brandName: lead.brandName,
            assignedAdvisor: lead.counsellorName,
          });
          totalSent++;
        } catch (err) {
          console.error(`Drip dispatch error for ${lead.studentName}:`, err);
        }
      }
    }

    // Update Campaign statistics in DB
    campaign.totalMessagesSent = (campaign.totalMessagesSent || 0) + totalSent;
    campaign.totalTargetLeads = targetLeads.length;
    if (Array.isArray(campaign.steps)) {
      campaign.steps.forEach((step: any) => {
        step.sentCount = (step.sentCount || 0) + totalSent;
        step.deliveredCount = (step.deliveredCount || 0) + totalSent;
      });
    }
    await campaign.save();

    return NextResponse.json({
      success: true,
      message: `Drip campaign sequence executed successfully! Dispatched automated WhatsApp messages to ${totalSent} leads out of ${targetLeads.length} target recipients.`,
      details: {
        totalSent,
        targetLeadsCount: targetLeads.length,
        campaignName: campaign.campaignName,
      },
    });
  } catch (error: any) {
    console.error("Error triggering drip campaign:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to trigger drip campaign" },
      { status: 500 }
    );
  }
}
