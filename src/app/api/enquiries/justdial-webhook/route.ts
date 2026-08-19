import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import User from "@/models/User";
import Task from "@/models/Task";
import JustdialConfig from "@/models/JustdialConfig";
import JustdialLeadLog from "@/models/JustdialLeadLog";
import { sendWhatsAppWelcomeEnquiry, sendWhatsAppSuperAdminEnquiryAlert } from "@/lib/msg91";

// CORS Preflight handler
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
      },
    }
  );
}

/**
 * Universal payload parser for Justdial Webhook/Push API
 */
async function parseIncomingPayload(req: NextRequest): Promise<{ body: any; raw: any }> {
  let body: any = {};
  const contentType = req.headers.get("content-type") || "";

  // 1. Check URL query parameters (GET or POST with query string)
  const searchParams = req.nextUrl.searchParams;
  searchParams.forEach((val, key) => {
    body[key] = val;
  });

  // 2. Parse request body if present
  if (req.method !== "GET") {
    try {
      if (contentType.includes("application/json")) {
        const json = await req.json();
        body = { ...body, ...json };
      } else if (
        contentType.includes("application/x-www-form-urlencoded") ||
        contentType.includes("multipart/form-data")
      ) {
        const formData = await req.formData();
        formData.forEach((val, key) => {
          body[key] = typeof val === "string" ? val : val.name;
        });
      } else {
        const text = await req.text();
        if (text && text.trim()) {
          try {
            const parsed = JSON.parse(text);
            body = { ...body, ...parsed };
          } catch {
            // Check if text is URL-encoded string like a=1&b=2
            const params = new URLSearchParams(text);
            let hasParams = false;
            params.forEach((val, key) => {
              body[key] = val;
              hasParams = true;
            });
            if (!hasParams) {
              body.rawText = text;
            }
          }
        }
      }
    } catch (parseErr) {
      console.warn("[Justdial Webhook] Body parsing warning:", parseErr);
    }
  }

  // 3. Check for nested JSON strings inside parameters (e.g. data={"leadid": "..."} or lead_data=...)
  const nestedKeys = ["data", "lead_data", "lead", "payload", "leadDetails", "lead_details"];
  for (const k of nestedKeys) {
    if (body[k] && typeof body[k] === "string") {
      try {
        const nested = JSON.parse(body[k]);
        if (typeof nested === "object" && nested !== null) {
          body = { ...body, ...nested };
        }
      } catch {
        // Not a JSON string, keep as is
      }
    }
  }

  return { body, raw: body };
}

/**
 * Handle incoming Justdial lead processing (used by both GET and POST)
 */
async function handleJustdialLead(req: NextRequest, isSimulation = false) {
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";

  let parsedData: any = {};

  try {
    await dbConnect();
    const { body, raw } = await parseIncomingPayload(req);
    parsedData = raw;

    // Load active Justdial configuration
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
        sendWelcomeWhatsApp: true,
        sendAdminAlertWhatsApp: true,
        createFollowUpTask: true,
        courseMappings: [],
        apiLastUpdatedTime: new Date(),
      });
      config = created.toObject();
    }

    // 1. API Key Validation (if required)
    const incomingApiKey =
      body.apiKey ||
      body.api_key ||
      body.key ||
      body.token ||
      body.auth_key ||
      req.headers.get("x-api-key") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";

    if (config.requireApiKey && config.apiKey && !isSimulation) {
      if (incomingApiKey.trim() !== config.apiKey.trim()) {
        await JustdialLeadLog.create({
          timestamp: new Date(),
          sourceType: "PUSH_WEBHOOK",
          httpMethod: req.method,
          status: "UNAUTHORIZED",
          rawPayload: raw,
          responseMessage: "Unauthorized: Invalid API Key",
          errorDetails: `Received key '${incomingApiKey}' did not match configured key.`,
          ip: clientIp,
        });

        return NextResponse.json(
          {
            status: "ERROR",
            code: 401,
            message: "Unauthorized: Invalid or missing API Key for Justdial Connector.",
          },
          {
            status: 401,
            headers: { "Access-Control-Allow-Origin": "*" },
          }
        );
      }
    }

    // 2. Exhaustive Field Extraction & Normalization
    const leadId =
      body.leadid ||
      body.lead_id ||
      body.leadId ||
      body.leadID ||
      body.id ||
      body.lead_no ||
      body.leadno ||
      body.leadRef ||
      "";

    const leadType =
      body.leadtype ||
      body.lead_type ||
      body.leadType ||
      "";

    let rawName =
      body.name ||
      body.studentFullName ||
      body.lead_name ||
      body.caller_name ||
      body.customer_name ||
      body.leadName ||
      body.callerName ||
      body.customerName ||
      body.contact_person ||
      body.fullName ||
      body.fullname ||
      body.studentName ||
      body["Student Name"] ||
      body["Full Name"] ||
      "";

    // Clean prefix (Mr./Ms./Dr.)
    rawName = rawName.replace(/^(mr\.?|ms\.?|mrs\.?|dr\.?)\s+/i, "").trim();
    const studentFullName = rawName || "Justdial Inquiry";

    let rawMobile =
      body.mobile ||
      body.phone ||
      body.primaryPhoneMobile ||
      body.lead_mobile ||
      body.caller_mobile ||
      body.customer_mobile ||
      body.mobile_number ||
      body.contact ||
      body.contact_number ||
      body.phone_number ||
      body.phone1 ||
      body.cellphone ||
      body["Mobile Number"] ||
      body["Phone"] ||
      "";

    const cleanDigits = String(rawMobile).replace(/\D/g, "").slice(-10);
    const primaryPhoneMobile = cleanDigits.length === 10 ? `+91 ${cleanDigits}` : String(rawMobile).trim();

    const altMobile =
      body.phone2 ||
      body.alt_mobile ||
      body.alternate_mobile ||
      body.alternate_phone ||
      body.alt_phone ||
      "";

    const emailAddress =
      body.email ||
      body.emailAddress ||
      body.lead_email ||
      body.customer_email ||
      body.email_id ||
      body.mail ||
      body["Email Address"] ||
      "";

    const currentCity =
      body.city ||
      body.customer_city ||
      body.location ||
      body.currentCity ||
      body.lead_city ||
      body["City"] ||
      "";

    const area =
      body.area ||
      body.address ||
      body.locality ||
      body.landmark ||
      body.pincode ||
      body.state ||
      body["Area"] ||
      "";

    const justdialCategory =
      body.category ||
      body.catname ||
      body.cat_name ||
      body.category_name ||
      body.product ||
      body.course ||
      body.parent_category ||
      body.service ||
      body["Category"] ||
      "";

    const queryMessage =
      body.query ||
      body.requirement ||
      body.message ||
      body.remarks ||
      body.lead_description ||
      body.comment ||
      body.notes ||
      "";

    // 3. Multi-tier Intelligent Course & Counselor & Brand Matching
    let matchedCourse = config.defaultCourse || "";
    let matchedCounselor = config.counselorName || "";
    let targetBrand = config.defaultBrand || "CADD MANTRA";

    if (justdialCategory && Array.isArray(config.courseMappings) && config.courseMappings.length > 0) {
      const cleanCat = justdialCategory.toLowerCase().trim();

      // Tier 1: Exact match
      let mapping = config.courseMappings.find(
        (m: any) => m.justdialCategory && m.justdialCategory.toLowerCase().trim() === cleanCat
      );

      // Tier 2: Substring match (incoming category contains mapped string OR mapped string contains incoming category)
      if (!mapping) {
        mapping = config.courseMappings.find((m: any) => {
          if (!m.justdialCategory) return false;
          const mappedCat = m.justdialCategory.toLowerCase().trim();
          return cleanCat.includes(mappedCat) || mappedCat.includes(cleanCat);
        });
      }

      // Tier 3: Keyword word-boundary match (e.g. "AutoCAD", "Revit", "Python")
      if (!mapping) {
        const catWords = cleanCat.split(/\s+/).filter((w: string) => w.length > 2);
        mapping = config.courseMappings.find((m: any) => {
          if (!m.justdialCategory) return false;
          const mappedCat = m.justdialCategory.toLowerCase().trim();
          return catWords.some((word: string) => mappedCat.includes(word));
        });
      }

      if (mapping) {
        if (mapping.course) matchedCourse = mapping.course;
        if (mapping.counselorName && mapping.counselorName.trim()) {
          matchedCounselor = mapping.counselorName.trim();
        }
        if (mapping.brand && mapping.brand.trim()) {
          targetBrand = mapping.brand.trim();
        }
      }
    }

    // Fallback: If no counselor assigned, auto-assign via round-robin Centre Head or Counselor
    if (!matchedCounselor && config.autoAssignAdvisor !== false) {
      try {
        const escapeRegExp = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        const brandRegex = new RegExp(`(^|[,\\/|\\s])${escapeRegExp(targetBrand)}($|[,\\/|\\s])`, "i");

        const centreHeadRoles = [
          "centre head",
          "centre_head",
          "center head",
          "center_head",
          "branch head",
          "brand manager",
        ];

        const brandHeads = await User.find({
          role: { $in: centreHeadRoles },
          $or: [
            { brandScope: { $regex: brandRegex } },
            { brandScope: { $in: ["All", "All Brands", "global", "*"] } },
          ],
        }).lean();

        if (brandHeads.length > 0) {
          const headCounts = await Promise.all(
            brandHeads.map(async (h: any) => {
              const count = await Enquiry.countDocuments({ assignedCrmAdvisor: h.name });
              return { name: h.name, count };
            })
          );
          headCounts.sort((a, b) => a.count - b.count);
          matchedCounselor = headCounts[0].name;
        } else {
          const defaultHead = await User.findOne({ role: { $in: centreHeadRoles } }).lean();
          if (defaultHead && (defaultHead as any).name) {
            matchedCounselor = (defaultHead as any).name;
          }
        }
      } catch (assignErr) {
        console.warn("[Justdial Webhook] Auto-assignment fallback warning:", assignErr);
      }
    }

    if (!matchedCounselor) {
      matchedCounselor = "HO - TARANG SINGHAL - SICCES PVT LTD";
    }

    // 4. Deduplication Check (within last 2 hours)
    if (primaryPhoneMobile && primaryPhoneMobile !== "0000000000") {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const existingRecentEnquiry = await Enquiry.findOne({
        primaryPhoneMobile,
        createdAt: { $gte: twoHoursAgo },
      });

      if (existingRecentEnquiry) {
        // Record duplicate hit in log
        await JustdialLeadLog.create({
          timestamp: new Date(),
          sourceType: isSimulation ? "SIMULATION_TEST" : "PUSH_WEBHOOK",
          httpMethod: req.method,
          status: "DUPLICATE",
          leadName: studentFullName,
          mobile: primaryPhoneMobile,
          email: emailAddress,
          category: justdialCategory,
          matchedCourse,
          assignedCounselor: matchedCounselor,
          brand: targetBrand,
          enquiryId: existingRecentEnquiry.enquiryId || existingRecentEnquiry._id.toString(),
          rawPayload: raw,
          responseMessage: `Duplicate lead ignored (matched existing enquiry ${existingRecentEnquiry.enquiryId})`,
          ip: clientIp,
        });

        // Append note to existing lead
        try {
          await Enquiry.updateOne(
            { _id: existingRecentEnquiry._id },
            {
              $push: {
                followUps: {
                  date: new Date().toISOString().split("T")[0],
                  time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
                  priority: "High",
                  typeOfContact: "Justdial Push Repeat",
                  remarks: `Repeated Justdial lead received. Category: ${justdialCategory || "N/A"}. Query: ${queryMessage || "None"}`,
                  status: "Pending",
                  createdAt: new Date(),
                },
              },
            }
          );
        } catch (_) {}

        return NextResponse.json(
          {
            status: "SUCCESS",
            code: 200,
            message: "Lead already recorded recently (deduplicated).",
            enquiryId: existingRecentEnquiry.enquiryId,
            isDuplicate: true,
          },
          {
            headers: { "Access-Control-Allow-Origin": "*" },
          }
        );
      }
    }

    // 5. Generate Remarks & Structured Notes
    const remarksParts = [
      leadId ? `Justdial Lead ID: ${leadId}` : null,
      leadType ? `Lead Type: ${leadType}` : null,
      justdialCategory ? `Justdial Category: ${justdialCategory}` : null,
      area ? `Location/Area: ${area}` : null,
      altMobile ? `Alt Mobile: ${altMobile}` : null,
      queryMessage ? `Inquiry Note: ${queryMessage}` : null,
    ].filter(Boolean);

    const fullRemarks = remarksParts.length > 0 ? remarksParts.join(" | ") : "Incoming Justdial Lead";

    // 6. Auto-generate Unique Enquiry ID
    const year = new Date().getFullYear();
    const count = await Enquiry.countDocuments({});
    const enquiryId = `JD-${year}-${String(count + 1).padStart(4, "0")}`;

    const coursesArray = matchedCourse ? [matchedCourse] : ["General Course"];

    // 7. Create Enquiry Document
    const newEnquiry: any = await Enquiry.create({
      enquiryId,
      studentFullName,
      date: new Date().toISOString().split("T")[0],
      primaryPhoneMobile,
      emailAddress,
      currentCity: currentCity || "N/A",
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
      utmMedium: "push_webhook",
      utmCampaign: justdialCategory || "justdial_leads",
      leadTags: ["Justdial", justdialCategory].filter(Boolean),
    });

    // 8. Update JustdialConfig Stats
    try {
      await JustdialConfig.updateOne(
        { _id: config._id },
        {
          $inc: { totalLeadsReceived: 1 },
          $set: { lastLeadReceivedAt: new Date() },
        }
      );
    } catch (_) {}

    // 9. Auto-create CRM Follow-up Task for Assigned Counselor
    if (config.createFollowUpTask !== false) {
      try {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);
        await Task.create({
          title: `Justdial Lead: ${studentFullName}`,
          description: `New Justdial lead received for ${targetBrand} - ${matchedCourse || justdialCategory}. Please call student immediately. Phone: ${primaryPhoneMobile}. Remarks: ${fullRemarks}`,
          taskType: "Lead Call",
          linkedStudentName: studentFullName,
          linkedEnquiryId: newEnquiry._id.toString(),
          assignedTo: matchedCounselor,
          priority: "High",
          status: "Pending",
          dueDate,
        });
      } catch (taskErr) {
        console.error("[Justdial Webhook] Task creation error:", taskErr);
      }
    }

    // 10. Trigger WhatsApp Notifications
    // (a) MSG91 Super Admin Enquiry Alert WhatsApp
    if (config.sendAdminAlertWhatsApp !== false) {
      try {
        sendWhatsAppSuperAdminEnquiryAlert({
          studentName: studentFullName,
          studentMobile: primaryPhoneMobile || "N/A",
          courseName: matchedCourse || "General Course",
          brandName: targetBrand,
          counsellorName: matchedCounselor,
          leadSource: config.leadSource || "JustDial",
          date: newEnquiry.date,
        })
          .then((res) => console.log(`[Justdial Webhook] Super Admin WhatsApp Alert sent:`, res))
          .catch((err) => console.error("[Justdial Webhook] Super Admin WhatsApp Alert error:", err));
      } catch (alertErr) {
        console.error("[Justdial Webhook] Super admin alert dispatch failed:", alertErr);
      }
    }

    // (b) MSG91 Student Welcome WhatsApp
    if (config.sendWelcomeWhatsApp !== false && primaryPhoneMobile && cleanDigits.length === 10) {
      try {
        sendWhatsAppWelcomeEnquiry({
          studentName: studentFullName || "Student",
          mobileNumber: primaryPhoneMobile,
          brandName: targetBrand,
          courseName: matchedCourse || "Course",
        })
          .then((res) => console.log(`[Justdial Webhook] Student Welcome WhatsApp sent to ${primaryPhoneMobile}:`, res))
          .catch((err) => console.error("[Justdial Webhook] Student Welcome WhatsApp error:", err));
      } catch (welcomeErr) {
        console.error("[Justdial Webhook] Student welcome WhatsApp dispatch failed:", welcomeErr);
      }
    }

    // 11. Record Successful Activity in JustdialLeadLog
    await JustdialLeadLog.create({
      timestamp: new Date(),
      sourceType: isSimulation ? "SIMULATION_TEST" : "PUSH_WEBHOOK",
      httpMethod: req.method,
      status: "SUCCESS",
      leadName: studentFullName,
      mobile: primaryPhoneMobile,
      email: emailAddress,
      category: justdialCategory,
      matchedCourse,
      assignedCounselor: matchedCounselor,
      brand: targetBrand,
      enquiryId: newEnquiry.enquiryId,
      rawPayload: raw,
      responseMessage: "Lead captured and registered successfully",
      ip: clientIp,
    });

    return NextResponse.json(
      {
        status: "SUCCESS",
        code: 200,
        message: "Justdial Lead captured and registered successfully",
        enquiryId: newEnquiry.enquiryId,
        matchedCourse,
        assignedCounselor: matchedCounselor,
        brand: targetBrand,
        lead: newEnquiry,
      },
      {
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error: any) {
    console.error("[Justdial Webhook] Error processing lead:", error);

    // Record Failure in JustdialLeadLog
    try {
      await JustdialLeadLog.create({
        timestamp: new Date(),
        sourceType: isSimulation ? "SIMULATION_TEST" : "PUSH_WEBHOOK",
        httpMethod: req.method,
        status: "FAILED",
        rawPayload: parsedData,
        responseMessage: "Failed to process lead",
        errorDetails: error.message || "Internal processing error",
        ip: clientIp,
      });
    } catch (_) {}

    return NextResponse.json(
      {
        status: "ERROR",
        code: 500,
        error: error.message || "Failed to process Justdial lead webhook",
      },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}

export async function POST(req: NextRequest) {
  return handleJustdialLead(req, false);
}

export async function GET(req: NextRequest) {
  return handleJustdialLead(req, false);
}
