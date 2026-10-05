import { todayKey } from "@/lib/dates";
import crypto from "node:crypto";
import Enquiry from "@/models/Enquiry";
import Task from "@/models/Task";
import FacebookLeadConfig from "@/models/FacebookLeadConfig";
import FacebookLeadLog, { type FacebookLeadSourceType } from "@/models/FacebookLeadLog";
import { sendWhatsAppWelcomeEnquiry, sendWhatsAppSuperAdminEnquiryAlert } from "@/lib/msg91";
import { decryptField } from "@/lib/encryption";

/**
 * Facebook / Instagram Lead Ads connector.
 *
 * Flow: Meta sends a "leadgen" webhook containing only IDs -> we fetch the lead's answers
 * from the Graph API with the Page access token -> ingestFacebookLead() creates the enquiry.
 * Pull sync and the simulator feed the same ingestFacebookLead(), and every path is idempotent
 * on the Meta lead ID, so a lead can be delivered any number of times and is imported once.
 */

export const FB_DEFAULT_COUNSELLOR = "HO - TARANG SINGHAL - SICCES PVT LTD";
const GRAPH_HOST = "https://graph.facebook.com";

// Fields requested for every lead read from the Graph API
export const LEAD_FIELDS =
  "id,created_time,field_data,form_id,ad_id,ad_name,adset_name,campaign_name,platform,is_organic";

export interface FacebookLead {
  id: string;
  created_time?: string;
  form_id?: string;
  ad_id?: string;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  platform?: string;
  is_organic?: boolean;
  field_data?: { name: string; values?: string[] }[];
}

/** Loads the connector config with secrets decrypted. Creates the default config on first use. */
export async function loadFacebookConfig() {
  let config: any = await FacebookLeadConfig.findOne({}).select("+appSecret +pageAccessToken").lean();
  if (!config) {
    const created = await FacebookLeadConfig.create({ verifyToken: generateVerifyToken() });
    config = created.toObject();
  }
  return {
    ...config,
    appSecret: decryptField(config.appSecret) || "",
    pageAccessToken: decryptField(config.pageAccessToken) || "",
  };
}

export function generateVerifyToken(): string {
  return `fb-verify-${crypto.randomBytes(12).toString("hex")}`;
}

// ---------------------------------------------------------------------------
// Graph API
// ---------------------------------------------------------------------------

export class GraphApiError extends Error {
  status: number;
  code?: number;
  constructor(message: string, status: number, code?: number) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function graphRequest(
  path: string,
  accessToken: string,
  version: string,
  params: Record<string, string> = {},
  method: "GET" | "POST" = "GET"
): Promise<any> {
  const url = new URL(`${GRAPH_HOST}/${version || "v26.0"}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", accessToken);
  return graphFetch(url.toString(), method);
}

/** Follows an absolute Graph URL (e.g. paging.next, which already carries the token). */
export async function graphFetch(url: string, method: "GET" | "POST" = "GET"): Promise<any> {
  const res = await fetch(url, { method, headers: { Accept: "application/json" } });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON error page
  }
  if (!res.ok || json?.error) {
    const msg = json?.error?.message || text.slice(0, 300) || `HTTP ${res.status}`;
    throw new GraphApiError(`Meta Graph API: ${msg}`, res.status, json?.error?.code);
  }
  return json;
}

export async function fetchLeadById(leadgenId: string, config: any): Promise<FacebookLead> {
  if (!config.pageAccessToken) {
    throw new GraphApiError("Page access token is not configured.", 400);
  }
  return graphRequest(leadgenId, config.pageAccessToken, config.graphApiVersion, { fields: LEAD_FIELDS });
}

// ---------------------------------------------------------------------------
// Webhook signature (X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(rawBody, appSecret))
// ---------------------------------------------------------------------------

export function isValidMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !appSecret) return false;
  const received = signatureHeader.replace(/^sha256=/i, "").trim().toLowerCase();
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

// ---------------------------------------------------------------------------
// Lead answers -> enquiry fields
// ---------------------------------------------------------------------------

export function normalizeIndianMobile(raw: string): { display: string; valid: boolean } {
  const digits = String(raw || "").replace(/\D/g, "");
  let ten = "";
  if (digits.length === 10) ten = digits;
  else if (digits.length === 12 && digits.startsWith("91")) ten = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) ten = digits.slice(1);

  if (ten && !/^0+$/.test(ten)) return { display: `+91 ${ten}`, valid: true };
  // Foreign or malformed numbers are kept as given so staff can still see them
  return { display: digits ? `+${digits}` : "", valid: false };
}

const humanize = (key: string) =>
  key
    .replace(/[_?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());

export function parseFieldData(fieldData: FacebookLead["field_data"] = []) {
  const answers: Record<string, string> = {};
  for (const f of fieldData || []) {
    if (!f?.name) continue;
    answers[f.name.toLowerCase()] = (f.values || []).filter(Boolean).join(", ").trim();
  }

  const find = (...patterns: RegExp[]) => {
    for (const p of patterns) {
      const key = Object.keys(answers).find((k) => p.test(k) && answers[k]);
      if (key) return { key, value: answers[key] };
    }
    return null;
  };

  const used = new Set<string>();
  const take = (...patterns: RegExp[]) => {
    const hit = find(...patterns);
    if (hit) used.add(hit.key);
    return hit?.value || "";
  };

  let fullName = take(/^full_?name$/, /^name$/);
  if (!fullName) {
    const first = take(/^first_?name$/);
    const last = take(/^last_?name$/);
    fullName = [first, last].filter(Boolean).join(" ");
  }

  const phone = take(/^phone(_number)?$/, /mobile/, /phone/, /whatsapp/);
  const email = take(/^email$/, /e-?mail/);
  const city = take(/^city$/, /city/, /location/);
  const course = take(/course/, /program/, /interested/);

  // Everything else (custom questions, state, zip...) goes into remarks
  const extras = Object.entries(answers)
    .filter(([k, v]) => v && !used.has(k))
    .map(([k, v]) => `${humanize(k)}: ${v}`);

  return { fullName, phone, email, city, course, extras };
}

// ---------------------------------------------------------------------------
// Ingestion
// ---------------------------------------------------------------------------

export interface IngestOptions {
  sourceType: FacebookLeadSourceType;
  pageId?: string;
  /** Simulator only: force WhatsApp on/off regardless of config */
  sendWhatsApp?: boolean;
}

export interface IngestResult {
  status: "SUCCESS" | "DUPLICATE";
  enquiryId?: string;
  message: string;
  matchedCourse?: string;
  assignedCounselor?: string;
  brand?: string;
}

const isDuplicateKeyError = (err: any) => err?.code === 11000;

export async function ingestFacebookLead(lead: FacebookLead, config: any, opts: IngestOptions): Promise<IngestResult> {
  const leadgenId = String(lead.id || "").trim();
  if (!leadgenId) throw new Error("Lead is missing its Meta lead ID.");

  const parsed = parseFieldData(lead.field_data);
  const studentFullName = parsed.fullName.replace(/^(mr\.?|ms\.?|mrs\.?|dr\.?)\s+/i, "").trim() || "Facebook Lead";
  const mobile = normalizeIndianMobile(parsed.phone);

  // Routing: form mapping > course answer > defaults
  const mapping = (config.formMappings || []).find((m: any) => m.formId && m.formId === lead.form_id);
  const matchedCourse = mapping?.course || parsed.course || config.defaultCourse || "";
  const targetBrand = mapping?.brand || config.defaultBrand || "CADD MANTRA";
  const assignedCounselor = mapping?.counselorName || config.counselorName || FB_DEFAULT_COUNSELLOR;
  const formName = mapping?.formName || "";
  const platform = lead.platform === "ig" ? "Instagram" : lead.platform === "fb" ? "Facebook" : lead.platform || "";

  const baseLog = {
    timestamp: new Date(),
    sourceType: opts.sourceType,
    leadgenId,
    formId: lead.form_id || "",
    formName,
    pageId: opts.pageId || config.pageId || "",
    adId: lead.ad_id || "",
    campaignName: lead.campaign_name || "",
    platform,
    leadName: studentFullName,
    mobile: mobile.display,
    email: parsed.email,
    matchedCourse,
    assignedCounselor,
    brand: targetBrand,
    rawPayload: lead,
  };

  // 1. Claim the lead ID. The unique index on SUCCESS logs makes this atomic, so concurrent
  //    webhook retries / pull syncs cannot both create an enquiry.
  await FacebookLeadLog.init(); // ensures the unique index exists (no-op after the first call)
  let claim: any;
  try {
    claim = await FacebookLeadLog.create({ ...baseLog, status: "SUCCESS", responseMessage: "Processing" });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const existing: any = await FacebookLeadLog.findOne({ leadgenId, status: "SUCCESS" }).lean();
    return {
      status: "DUPLICATE",
      enquiryId: existing?.enquiryId,
      message: "Lead already imported (same Meta lead ID).",
    };
  }

  try {
    // 2. Same person re-submitting within 2 hours: add a follow-up note instead of a second enquiry
    if (mobile.valid) {
      const recent: any = await Enquiry.findOne({
        primaryPhoneMobile: mobile.display,
        createdAt: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      });
      if (recent) {
        await Enquiry.updateOne(
          { _id: recent._id },
          {
            $push: {
              followUps: {
                date: todayKey(),
                time: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }),
                priority: "High",
                typeOfContact: "Facebook Lead Repeat",
                remarks: `Repeated Facebook lead received${lead.campaign_name ? ` (campaign: ${lead.campaign_name})` : ""}.`,
                status: "Pending",
                createdAt: new Date(),
              },
            },
          }
        );
        // Release the SUCCESS claim; the lead is recorded as a duplicate of the existing enquiry
        await FacebookLeadLog.updateOne(
          { _id: claim._id },
          {
            $set: {
              status: "DUPLICATE",
              enquiryId: recent.enquiryId,
              responseMessage: `Duplicate phone within 2 hours (existing enquiry ${recent.enquiryId}).`,
            },
          }
        );
        return {
          status: "DUPLICATE",
          enquiryId: recent.enquiryId,
          message: "Same phone number enquired in the last 2 hours; note added to existing enquiry.",
        };
      }
    }

    // 3. Create the enquiry (enquiryId comes from the Enquiry model's atomic sequence)
    const remarks = [
      `Meta Lead ID: ${leadgenId}`,
      platform ? `Platform: ${platform}` : null,
      lead.campaign_name ? `Campaign: ${lead.campaign_name}` : null,
      lead.ad_name ? `Ad: ${lead.ad_name}` : null,
      formName ? `Form: ${formName}` : lead.form_id ? `Form ID: ${lead.form_id}` : null,
      parsed.course && parsed.course !== matchedCourse ? `Course answer: ${parsed.course}` : null,
      ...parsed.extras,
    ]
      .filter(Boolean)
      .join(" | ");

    const courses = matchedCourse ? [matchedCourse] : ["General Course"];
    const enquiry: any = await Enquiry.create({
      studentFullName,
      date: todayKey(),
      primaryPhoneMobile: mobile.display,
      emailAddress: parsed.email,
      currentCity: parsed.city || "N/A",
      targetBrand,
      targetCourse: matchedCourse || "General Course",
      targetCourses: courses,
      courses,
      leadSource: config.leadSource || "Meta Ads",
      status: config.leadStage || "New / Fresh Inquiry",
      assignedCrmAdvisor: assignedCounselor,
      priorityLevel: "High",
      remarks,
      utmSource: platform ? platform.toLowerCase() : "facebook",
      utmMedium: lead.is_organic ? "organic_lead_form" : "paid_lead_ad",
      utmCampaign: lead.campaign_name || formName || "facebook_lead_ads",
      leadTags: ["Facebook Lead Ads", platform, opts.sourceType === "SIMULATION_TEST" ? "Simulation" : ""].filter(
        (t): t is string => Boolean(t)
      ),
    });

    await FacebookLeadLog.updateOne(
      { _id: claim._id },
      { $set: { enquiryId: enquiry.enquiryId, responseMessage: "Lead captured and enquiry created." } }
    );

    await FacebookLeadConfig.updateOne(
      {},
      { $inc: { totalLeadsReceived: 1 }, $set: { lastLeadReceivedAt: new Date() } }
    ).catch(() => {});

    // 4. Follow-up task for the assigned counsellor
    if (config.createFollowUpTask !== false) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);
      await Task.create({
        title: `Facebook Lead: ${studentFullName}`,
        description: `New ${platform || "Facebook"} lead for ${targetBrand} - ${matchedCourse || "General Course"}. Call immediately. Phone: ${mobile.display || "N/A"}.`,
        taskType: "Lead Call",
        linkedType: "Enquiry",
        linkedStudentName: studentFullName,
        linkedEnquiryId: enquiry._id.toString(),
        assignedTo: assignedCounselor,
        priority: "High",
        status: "Pending",
        dueDate,
      }).catch((err: any) => console.error("[Facebook Leads] Task creation error:", err));
    }

    // 5. WhatsApp notifications (fire and forget)
    const adminAlert = opts.sendWhatsApp ?? config.sendAdminAlertWhatsApp !== false;
    const welcome = opts.sendWhatsApp ?? config.sendWelcomeWhatsApp !== false;
    if (adminAlert) {
      sendWhatsAppSuperAdminEnquiryAlert({
        studentName: studentFullName,
        studentMobile: mobile.display || "N/A",
        courseName: matchedCourse || "General Course",
        brandName: targetBrand,
        counsellorName: assignedCounselor,
        leadSource: config.leadSource || "Meta Ads",
        date: enquiry.date,
      }).catch((err: any) => console.error("[Facebook Leads] Admin WhatsApp alert error:", err));
    }
    if (welcome && mobile.valid) {
      sendWhatsAppWelcomeEnquiry({
        studentName: studentFullName,
        mobileNumber: mobile.display,
        brandName: targetBrand,
        courseName: matchedCourse || "Course",
      }).catch((err: any) => console.error("[Facebook Leads] Welcome WhatsApp error:", err));
    }

    return {
      status: "SUCCESS",
      enquiryId: enquiry.enquiryId,
      message: "Lead captured and enquiry created.",
      matchedCourse,
      assignedCounselor,
      brand: targetBrand,
    };
  } catch (err: any) {
    // Release the claim so a retry (webhook redelivery or pull sync) can import this lead
    await FacebookLeadLog.updateOne(
      { _id: claim._id },
      { $set: { status: "FAILED", responseMessage: "Failed to create enquiry", errorDetails: err?.message || String(err) } }
    ).catch(() => {});
    throw err;
  }
}

/** Records a lead we could not even fetch/parse (e.g. bad token). Never holds the SUCCESS claim. */
export async function logFacebookFailure(
  sourceType: FacebookLeadSourceType,
  details: { leadgenId?: string; formId?: string; pageId?: string; rawPayload?: any },
  error: string,
  status: "FAILED" | "UNAUTHORIZED" = "FAILED"
) {
  try {
    await FacebookLeadLog.create({
      timestamp: new Date(),
      sourceType,
      status,
      ...details,
      responseMessage: status === "UNAUTHORIZED" ? "Rejected webhook request" : "Failed to process lead",
      errorDetails: error,
    });
  } catch (logErr) {
    console.error("[Facebook Leads] Could not write failure log:", logErr);
  }
}
