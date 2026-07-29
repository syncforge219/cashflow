import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import DripCampaign from "@/models/DripCampaign";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import { getUserFromCookies } from "@/lib/helper";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();

    const { searchParams } = new URL(req.url);
    const brandFilter = searchParams.get("brand");

    let query: any = { campaignId: { $ne: "SYSTEM_SEEDED_MARKER" } };
    if (brandFilter && brandFilter !== "All Brands" && brandFilter !== "ALL BRANDS" && brandFilter !== "All") {
      query = {
        campaignId: { $ne: "SYSTEM_SEEDED_MARKER" },
        $or: [
          { brandScope: { $regex: new RegExp(`^${brandFilter.trim()}$`, "i") } },
          { brandScope: "ALL BRANDS" }
        ]
      };
    } else if (user && user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "ALL BRANDS" && user.brandScope !== "All") {
      query = {
        campaignId: { $ne: "SYSTEM_SEEDED_MARKER" },
        $or: [{ brandScope: user.brandScope.toUpperCase() }, { brandScope: "ALL BRANDS" }]
      };
    }

    let campaigns = await DripCampaign.find(query).sort({ createdAt: -1 });
    const hasBeenSeeded = await DripCampaign.exists({ campaignId: "SYSTEM_SEEDED_MARKER" });

    // Seed default working Drip Campaigns ONLY ONCE on initial system setup
    if (!hasBeenSeeded && campaigns.length === 0) {
      const defaultCampaigns = [
        {
          campaignId: "SYSTEM_SEEDED_MARKER",
          campaignName: "SYSTEM_SEEDED_MARKER",
          targetAudience: "All Leads",
          status: "Draft",
        },
        {
          campaignName: "7-DAY NEW LEAD NURTURING SEQUENCE",
          targetAudience: "New Enquiries",
          targetCourse: "All Courses",
          brandScope: "ALL BRANDS",
          channel: "WhatsApp",
          status: "Active",
          totalTargetLeads: 13,
          totalMessagesSent: 42,
          convertedCount: 4,
          steps: [
            {
              stepNumber: 1,
              delayDays: 0,
              delayHours: 0,
              title: "Day 0: Welcome & Course Curriculum Handbook",
              messageTemplate: "Hi {studentName}, welcome to {brandName}! Thank you for enquiring about our {courseName} program. We have attached the complete industry-aligned syllabus & career pathway guide for you.",
              channel: "WhatsApp",
              sentCount: 13,
              deliveredCount: 13,
            },
            {
              stepNumber: 2,
              delayDays: 1,
              delayHours: 24,
              title: "Day 1: Free Live Practical Demo Class Invitation",
              messageTemplate: "Hello {studentName}, experience our hands-on coaching! You are invited to a FREE live Demo session for {courseName} with expert faculty tomorrow at 11:00 AM.",
              channel: "WhatsApp",
              sentCount: 12,
              deliveredCount: 12,
            },
            {
              stepNumber: 3,
              delayDays: 3,
              delayHours: 72,
              title: "Day 3: Student Alumni Placement Success Stories",
              messageTemplate: "Dear {studentName}, see how our alumni landed high-paying jobs after completing {courseName} at {brandName}! Talk to advisor {counsellorName} for career guidance.",
              channel: "WhatsApp",
              sentCount: 10,
              deliveredCount: 10,
            },
            {
              stepNumber: 4,
              delayDays: 7,
              delayHours: 168,
              title: "Day 7: Limited-Period Early Bird Scholarship Offer",
              messageTemplate: "Special Scholarship Alert for {studentName}! Enroll in {courseName} this week to get an exclusive ₹5,000 Early Bird discount. Reply YES to reserve your seat.",
              channel: "WhatsApp",
              sentCount: 7,
              deliveredCount: 7,
            },
          ],
        },
        {
          campaignName: "UNCONVERTED LEADS RE-ENGAGEMENT BOOSTER",
          targetAudience: "Unconverted Leads",
          targetCourse: "All Courses",
          brandScope: "ALL BRANDS",
          channel: "Omnichannel",
          status: "Active",
          totalTargetLeads: 18,
          totalMessagesSent: 36,
          convertedCount: 3,
          steps: [
            {
              stepNumber: 1,
              delayDays: 0,
              delayHours: 0,
              title: "Re-engagement: New Batch Commencement Notice",
              messageTemplate: "Hi {studentName}, new weekend & weekday batches for {courseName} are starting this Monday at {brandName}. Limited seats remaining!",
              channel: "WhatsApp",
              sentCount: 18,
              deliveredCount: 18,
            },
            {
              stepNumber: 2,
              delayDays: 4,
              delayHours: 96,
              title: "Re-engagement: Free Counselling & Campus Visit",
              messageTemplate: "Hello {studentName}, visit our campus this Saturday for a 1-on-1 career counselling session with our Senior Faculty. Book your slot now!",
              channel: "WhatsApp",
              sentCount: 18,
              deliveredCount: 17,
            },
          ],
        },
        {
          campaignName: "AUTOMATED FEE EMI RECOVERY DRIP",
          targetAudience: "Fee Pending Students",
          targetCourse: "All Courses",
          brandScope: "ALL BRANDS",
          channel: "WhatsApp",
          status: "Active",
          totalTargetLeads: 8,
          totalMessagesSent: 24,
          convertedCount: 6,
          steps: [
            {
              stepNumber: 1,
              delayDays: 0,
              delayHours: 0,
              title: "3 Days Before: Upcoming Fee Installment Reminder",
              messageTemplate: "Dear {studentName}, your upcoming fee installment for {courseName} is due soon. Kindly process your payment to maintain uninterrupted class access.",
              channel: "WhatsApp",
              sentCount: 8,
              deliveredCount: 8,
            },
            {
              stepNumber: 2,
              delayDays: 3,
              delayHours: 72,
              title: "Due Date: Payment Settlement Link & QR Code",
              messageTemplate: "Reminder for {studentName}: Your fee payment for {courseName} is due today. Use your student portal or contact finance for instant UPI settlement.",
              channel: "WhatsApp",
              sentCount: 8,
              deliveredCount: 8,
            },
            {
              stepNumber: 3,
              delayDays: 5,
              delayHours: 120,
              title: "2 Days Overdue: Urgency Notice",
              messageTemplate: "Important Alert: Fee payment for {studentName} ({courseName}) is overdue. Please complete settlement to avoid late processing fees.",
              channel: "WhatsApp",
              sentCount: 8,
              deliveredCount: 8,
            },
          ],
        },
      ];

      await DripCampaign.insertMany(defaultCampaigns);
      campaigns = await DripCampaign.find(query).sort({ createdAt: -1 });
    }

    // Calculate real brand-filtered audience numbers from MongoDB
    let enquiryBrandQuery: any = {};
    let admissionBrandQuery: any = {};

    if (brandFilter && brandFilter !== "All Brands" && brandFilter !== "ALL BRANDS" && brandFilter !== "All") {
      const brandRegex = new RegExp(`^${brandFilter.trim()}$`, "i");
      enquiryBrandQuery = { targetBrand: brandRegex };
      admissionBrandQuery = { $or: [{ brand: brandRegex }, { brandName: brandRegex }] };
    } else if (user && user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "ALL BRANDS" && user.brandScope !== "All") {
      const brandRegex = new RegExp(`^${user.brandScope.trim()}$`, "i");
      enquiryBrandQuery = { targetBrand: brandRegex };
      admissionBrandQuery = { $or: [{ brand: brandRegex }, { brandName: brandRegex }] };
    }

    const [enqCount, admCount, pendingCount] = await Promise.all([
      Enquiry.countDocuments(enquiryBrandQuery),
      Admission.countDocuments(admissionBrandQuery),
      Admission.countDocuments({ ...admissionBrandQuery, remainingBalance: { $gt: 0 } }),
    ]);

    return NextResponse.json({
      success: true,
      data: campaigns,
      audienceStats: {
        totalLeads: enqCount,
        totalAdmissions: admCount,
        feePendingStudents: pendingCount,
      },
    });
  } catch (error: any) {
    console.error("Error fetching drip campaigns:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch drip campaigns" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const body = await req.json();

    if (!body.campaignName || !body.campaignName.trim()) {
      return NextResponse.json(
        { success: false, message: "Campaign name is required." },
        { status: 400 }
      );
    }

    if (user && user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All") {
      body.brandScope = user.brandScope.toUpperCase();
    }

    // Ensure steps array exists and has at least 1 step
    if (!Array.isArray(body.steps) || body.steps.length === 0) {
      body.steps = [
        {
          stepNumber: 1,
          delayDays: 0,
          delayHours: 0,
          title: "Step 1: Instant Welcome Message",
          messageTemplate: "Hi {studentName}, welcome to {brandName}! Thank you for enquiring about our {courseName} program.",
          channel: body.channel || "WhatsApp",
        },
      ];
    }

    const newCampaign = await DripCampaign.create(body);

    return NextResponse.json(
      { success: true, data: newCampaign, message: "Drip campaign created successfully!" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating drip campaign:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create drip campaign" },
      { status: 500 }
    );
  }
}
