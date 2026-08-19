import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Task from "@/models/Task";
import JustdialConfig from "@/models/JustdialConfig";
import JustdialLeadLog from "@/models/JustdialLeadLog";
import { sendWhatsAppWelcomeEnquiry, sendWhatsAppSuperAdminEnquiryAlert } from "@/lib/msg91";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();

    const studentFullName = String(body.name || body.studentFullName || "Test Student Justdial").trim();
    const rawMobile = String(body.mobile || body.phone || "9876543210").trim();
    const cleanDigits = rawMobile.replace(/\D/g, "").slice(-10);
    const primaryPhoneMobile = cleanDigits.length === 10 ? `+91 ${cleanDigits}` : rawMobile;

    const emailAddress = String(body.email || "test.justdial@example.com").trim();
    const currentCity = String(body.city || "Lucknow").trim();
    const justdialCategory = String(body.category || "Interior Design Course").trim();
    const queryMessage = String(body.query || "Simulation test inquiry from Justdial Lead Connector").trim();

    // Load active config
    let config = await JustdialConfig.findOne({}).lean();
    if (!config) {
      const created = await JustdialConfig.create({
        connectorType: "Justdial Lead Connector Push API",
        leadSource: "JustDial",
        leadStage: "New / Fresh Inquiry",
        defaultBrand: "CADD MANTRA",
        counselorName: "HO - TARANG SINGHAL - SICCES PVT LTD",
        defaultCourse: "",
        apiKey: "JD-CF-API-KEY-984729103847",
        requireApiKey: false,
        autoAssignAdvisor: true,
        sendWelcomeWhatsApp: false, // In test mode default to false unless requested
        sendAdminAlertWhatsApp: false,
        createFollowUpTask: true,
        courseMappings: [],
        apiLastUpdatedTime: new Date(),
      });
      config = created.toObject();
    }

    // Matching logic
    let matchedCourse = config.defaultCourse || "";
    let matchedCounselor = config.counselorName || "HO - TARANG SINGHAL - SICCES PVT LTD";
    let targetBrand = config.defaultBrand || "CADD MANTRA";

    if (justdialCategory && Array.isArray(config.courseMappings) && config.courseMappings.length > 0) {
      const cleanCat = justdialCategory.toLowerCase().trim();

      let mapping = config.courseMappings.find(
        (m: any) => m.justdialCategory && m.justdialCategory.toLowerCase().trim() === cleanCat
      );

      if (!mapping) {
        mapping = config.courseMappings.find((m: any) => {
          if (!m.justdialCategory) return false;
          const mappedCat = m.justdialCategory.toLowerCase().trim();
          return cleanCat.includes(mappedCat) || mappedCat.includes(cleanCat);
        });
      }

      if (mapping) {
        if (mapping.course) matchedCourse = mapping.course;
        if (mapping.counselorName) matchedCounselor = mapping.counselorName;
        if (mapping.brand) targetBrand = mapping.brand;
      }
    }

    // Unique test enquiry ID
    const year = new Date().getFullYear();
    const count = await Enquiry.countDocuments({});
    const enquiryId = `JD-TEST-${year}-${String(count + 1).padStart(4, "0")}`;

    const coursesArray = matchedCourse ? [matchedCourse] : ["General Course"];
    const fullRemarks = `[TEST SIMULATION] Justdial Lead ID: JD-SIM-${Date.now()} | Category: ${justdialCategory} | Note: ${queryMessage}`;

    // Create enquiry
    const newEnquiry: any = await Enquiry.create({
      enquiryId,
      studentFullName,
      date: new Date().toISOString().split("T")[0],
      primaryPhoneMobile,
      emailAddress,
      currentCity,
      targetBrand,
      targetCourse: matchedCourse || "General Course",
      targetCourses: coursesArray,
      courses: coursesArray,
      leadSource: config.leadSource || "JustDial",
      status: config.leadStage || "New / Fresh Inquiry",
      assignedCrmAdvisor: matchedCounselor,
      priorityLevel: "High",
      remarks: fullRemarks,
      utmSource: "justdial_connector",
      utmMedium: "simulation_test",
      utmCampaign: justdialCategory,
      leadTags: ["Justdial", "Simulation", justdialCategory],
    });

    // Create test task
    if (body.createTask !== false) {
      try {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);
        await Task.create({
          title: `[Test] Justdial Lead: ${studentFullName}`,
          description: `Test simulation lead for ${targetBrand} - ${matchedCourse || justdialCategory}. Phone: ${primaryPhoneMobile}.`,
          taskType: "Lead Call",
          linkedStudentName: studentFullName,
          linkedEnquiryId: newEnquiry._id.toString(),
          assignedTo: matchedCounselor,
          priority: "Medium",
          status: "Pending",
          dueDate,
        });
      } catch (_) {}
    }

    // Optional WhatsApp dispatch if user explicitly checked in simulation
    let whatsappResults = { adminAlert: "skipped (test mode)", welcomeMsg: "skipped (test mode)" };
    if (body.sendLiveWhatsApp === true) {
      try {
        const adminRes = await sendWhatsAppSuperAdminEnquiryAlert({
          studentName: studentFullName,
          studentMobile: primaryPhoneMobile,
          courseName: matchedCourse || "General Course",
          brandName: targetBrand,
          counsellorName: matchedCounselor,
          leadSource: config.leadSource || "JustDial",
          date: newEnquiry.date,
        });
        whatsappResults.adminAlert = adminRes.success ? "sent" : `failed: ${adminRes.error}`;
      } catch (err: any) {
        whatsappResults.adminAlert = `error: ${err.message}`;
      }

      try {
        const welcomeRes = await sendWhatsAppWelcomeEnquiry({
          studentName: studentFullName,
          mobileNumber: primaryPhoneMobile,
          brandName: targetBrand,
          courseName: matchedCourse || "Course",
        });
        whatsappResults.welcomeMsg = welcomeRes.success ? "sent" : `failed: ${welcomeRes.error}`;
      } catch (err: any) {
        whatsappResults.welcomeMsg = `error: ${err.message}`;
      }
    }

    // Record in JustdialLeadLog
    const logDoc = await JustdialLeadLog.create({
      timestamp: new Date(),
      sourceType: "SIMULATION_TEST",
      httpMethod: "POST",
      status: "SUCCESS",
      leadName: studentFullName,
      mobile: primaryPhoneMobile,
      email: emailAddress,
      category: justdialCategory,
      matchedCourse,
      assignedCounselor: matchedCounselor,
      brand: targetBrand,
      enquiryId: newEnquiry.enquiryId,
      rawPayload: body,
      responseMessage: "Simulated test lead processed and verified successfully.",
      ip: "127.0.0.1",
    });

    // Update config counter
    await JustdialConfig.updateOne(
      { _id: config._id },
      {
        $inc: { totalLeadsReceived: 1 },
        $set: { lastLeadReceivedAt: new Date() },
      }
    );

    return NextResponse.json({
      success: true,
      message: "✅ Test Lead processed successfully through Justdial Connector pipeline!",
      diagnostics: {
        enquiryId: newEnquiry.enquiryId,
        studentFullName,
        primaryPhoneMobile,
        justdialCategory,
        matchedCourse: matchedCourse || "Default / Unmapped",
        assignedCounselor: matchedCounselor,
        targetBrand,
        leadSource: config.leadSource || "JustDial",
        logId: logDoc._id,
        whatsappResults,
      },
      enquiry: newEnquiry,
    });
  } catch (error: any) {
    console.error("Justdial Test Simulator Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to execute simulation test" },
      { status: 500 }
    );
  }
}
