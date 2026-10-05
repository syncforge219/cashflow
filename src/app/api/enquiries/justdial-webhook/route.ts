import { todayKey } from "@/lib/dates";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import User from "@/models/User";
import Task from "@/models/Task";
import JustdialConfig from "@/models/JustdialConfig";
import JustdialLeadLog from "@/models/JustdialLeadLog";
import { sendWhatsAppWelcomeEnquiry, sendWhatsAppSuperAdminEnquiryAlert } from "@/lib/msg91";
import { decryptField } from "@/lib/encryption";

// CORS Preflight handler
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, x-justdial-signature, x-webhook-signature, x-hub-signature-256",
      },
    }
  );
}

/**
 * Universal payload parser for Justdial Webhook/Push API
 */
async function parseIncomingPayload(req: NextRequest): Promise<{ body: any; raw: any; rawBodyText: string }> {
  let body: any = {};
  let rawBodyText = "";
  const contentType = req.headers.get("content-type") || "";

  // Capture clone of raw body text for HMAC signature verification
  if (req.method !== "GET") {
    try {
      rawBodyText = await req.clone().text();
    } catch {
      rawBodyText = "";
    }
  }

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

  return { body, raw: body, rawBodyText };
}

/**
 * Returns the first non-empty value among the given keys as a trimmed string.
 * Payload values can be numbers, arrays or objects, so never assume a string.
 */
function pickString(body: any, keys: string[]): string {
  for (const key of keys) {
    const val = body[key];
    if (val === undefined || val === null) continue;
    const str = (Array.isArray(val) ? val.join(", ") : typeof val === "object" ? "" : String(val)).trim();
    if (str) return str;
  }
  return "";
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
    const { body, raw, rawBodyText } = await parseIncomingPayload(req);
    parsedData = raw;

    // Load active Justdial configuration including encrypted credentials
    let config = await JustdialConfig.findOne({}).select("+apiKey +webhookSecret +pullApiKey").lean();
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

    // 1. Webhook Secret Signature Validation (HMAC-SHA256)
    const rawSecret = config.webhookSecret || process.env.JUSTDIAL_WEBHOOK_SECRET;
    const webhookSecret = rawSecret ? (decryptField(rawSecret) || rawSecret).trim() : "";

    const incomingSignature =
      req.headers.get("x-justdial-signature") ||
      req.headers.get("x-hub-signature-256") ||
      req.headers.get("x-webhook-signature") ||
      req.headers.get("x-signature") ||
      body.signature ||
      req.nextUrl.searchParams.get("signature") ||
      "";

    if (webhookSecret && !isSimulation) {
      // Reject unsigned requests when webhookSecret is configured
      if (!incomingSignature) {
        await JustdialLeadLog.create({
          timestamp: new Date(),
          sourceType: "PUSH_WEBHOOK",
          httpMethod: req.method,
          status: "UNAUTHORIZED",
          rawPayload: raw,
          responseMessage: "Unauthorized: Missing webhook signature",
          errorDetails: "Unsigned request rejected: Webhook secret is configured but no signature header was provided.",
          ip: clientIp,
        });

        return NextResponse.json(
          {
            status: "ERROR",
            code: 401,
            message: "Unauthorized: Webhook signature is required (unsigned requests are rejected).",
          },
          {
            status: 401,
            headers: { "Access-Control-Allow-Origin": "*" },
          }
        );
      }

      // Compute expected HMAC-SHA256 signature
      const payloadToSign = rawBodyText || JSON.stringify(body);
      const cleanIncomingSig = incomingSignature.replace(/^sha256=/i, "").trim().toLowerCase();
      const expectedSig = crypto
        .createHmac("sha256", webhookSecret)
        .update(payloadToSign)
        .digest("hex")
        .toLowerCase();

      let isSigValid = false;
      if (cleanIncomingSig.length === expectedSig.length) {
        isSigValid = crypto.timingSafeEqual(
          Buffer.from(cleanIncomingSig, "utf-8"),
          Buffer.from(expectedSig, "utf-8")
        );
      }

      if (!isSigValid) {
        await JustdialLeadLog.create({
          timestamp: new Date(),
          sourceType: "PUSH_WEBHOOK",
          httpMethod: req.method,
          status: "UNAUTHORIZED",
          rawPayload: raw,
          responseMessage: "Unauthorized: Invalid webhook signature",
          errorDetails: "HMAC-SHA256 signature verification failed against configured webhookSecret.",
          ip: clientIp,
        });

        return NextResponse.json(
          {
            status: "ERROR",
            code: 401,
            message: "Unauthorized: Invalid webhook signature.",
          },
          {
            status: 401,
            headers: { "Access-Control-Allow-Origin": "*" },
          }
        );
      }
    }

    // 2. API Key Validation (if required)
    const rawApiKey = config.apiKey;
    const configuredApiKey = rawApiKey ? (decryptField(rawApiKey) || rawApiKey).trim() : "";

    const incomingApiKey =
      pickString(body, ["apiKey", "api_key", "key", "token", "auth_key"]) ||
      req.headers.get("x-api-key") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";

    if (config.requireApiKey && configuredApiKey && !isSimulation) {
      const incomingBuf = Buffer.from(incomingApiKey.trim(), "utf-8");
      const configuredBuf = Buffer.from(configuredApiKey, "utf-8");
      const keyMatches =
        incomingBuf.length === configuredBuf.length && crypto.timingSafeEqual(incomingBuf, configuredBuf);

      if (!keyMatches) {
        await JustdialLeadLog.create({
          timestamp: new Date(),
          sourceType: "PUSH_WEBHOOK",
          httpMethod: req.method,
          status: "UNAUTHORIZED",
          rawPayload: raw,
          responseMessage: "Unauthorized: Invalid API Key",
          errorDetails: incomingApiKey
            ? "Received API key did not match configured key."
            : "No API key was provided in the request.",
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
    const leadId = pickString(body, [
      "leadid", "lead_id", "leadId", "leadID", "id", "lead_no", "leadno", "leadRef",
    ]);

    const leadType = pickString(body, ["leadtype", "lead_type", "leadType"]);

    const rawName = pickString(body, [
      "name", "studentFullName", "lead_name", "caller_name", "customer_name", "leadName",
      "callerName", "customerName", "contact_person", "fullName", "fullname", "studentName",
      "Student Name", "Full Name",
    ]);

    // Clean prefix (Mr./Ms./Dr.)
    const studentFullName = rawName.replace(/^(mr\.?|ms\.?|mrs\.?|dr\.?)\s+/i, "").trim() || "Justdial Inquiry";

    const rawMobile = pickString(body, [
      "mobile", "phone", "primaryPhoneMobile", "lead_mobile", "caller_mobile", "customer_mobile",
      "mobile_number", "contact", "contact_number", "phone_number", "phone1", "cellphone",
      "Mobile Number", "Phone",
    ]);

    const cleanDigits = rawMobile.replace(/\D/g, "").slice(-10);
    const hasValidMobile = cleanDigits.length === 10 && !/^0+$/.test(cleanDigits);
    const primaryPhoneMobile = cleanDigits.length === 10 ? `+91 ${cleanDigits}` : rawMobile;

    const altMobile = pickString(body, ["phone2", "alt_mobile", "alternate_mobile", "alternate_phone", "alt_phone"]);

    const emailAddress = pickString(body, [
      "email", "emailAddress", "lead_email", "customer_email", "email_id", "mail", "Email Address",
    ]);

    const currentCity = pickString(body, ["city", "customer_city", "location", "currentCity", "lead_city", "City"]);

    const area = pickString(body, ["area", "address", "locality", "landmark", "pincode", "state", "Area"]);

    const justdialCategory = pickString(body, [
      "category", "catname", "cat_name", "category_name", "product", "course", "parent_category",
      "service", "Category",
    ]);

    const queryMessage = pickString(body, [
      "query", "requirement", "message", "remarks", "lead_description", "comment", "notes",
    ]);

    // 2b. Lead-ID Idempotency: Justdial re-pushes the same lead on timeouts/retries
    if (leadId) {
      const alreadyProcessed = await JustdialLeadLog.findOne({ leadId, status: "SUCCESS" }).lean<any>();
      if (alreadyProcessed) {
        return NextResponse.json(
          {
            status: "SUCCESS",
            code: 200,
            message: "Lead already received (duplicate Justdial lead ID).",
            enquiryId: alreadyProcessed.enquiryId,
            isDuplicate: true,
          },
          {
            headers: { "Access-Control-Allow-Origin": "*" },
          }
        );
      }
    }

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
    if (hasValidMobile) {
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
                  date: todayKey(),
                  time: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }),
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

    const coursesArray = matchedCourse ? [matchedCourse] : ["General Course"];

    // 6-7. Create Enquiry Document (enquiryId is assigned atomically by the Enquiry pre-save sequence;
    // a count-based ID collides with the unique index once any enquiry is deleted or two leads arrive together)
    const newEnquiry: any = await Enquiry.create({
      studentFullName,
      date: todayKey(),
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
    if (config.sendWelcomeWhatsApp !== false && hasValidMobile) {
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
    // The enquiry already exists at this point: a logging failure must not turn into a 500,
    // otherwise Justdial retries and the lead gets created twice.
    try {
      await JustdialLeadLog.create({
        timestamp: new Date(),
        sourceType: isSimulation ? "SIMULATION_TEST" : "PUSH_WEBHOOK",
        httpMethod: req.method,
        status: "SUCCESS",
        leadName: studentFullName,
        ...(leadId ? { leadId } : {}),
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
    } catch (logErr) {
      console.error("[Justdial Webhook] Success log write failed:", logErr);
    }

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
