import { todayKey } from "@/lib/dates";
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Task from "@/models/Task";
import JustdialConfig from "@/models/JustdialConfig";
import JustdialLeadLog from "@/models/JustdialLeadLog";
import { sendWhatsAppWelcomeEnquiry, sendWhatsAppSuperAdminEnquiryAlert } from "@/lib/msg91";
import { decryptField } from "@/lib/encryption";
import { getDefaultBrandName } from "@/lib/brandDefaults";

const str = (val: any): string =>
  val === undefined || val === null || typeof val === "object" ? "" : String(val).trim();

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json().catch(() => ({}));

    const config: any = await JustdialConfig.findOne({}).select("+pullApiKey").lean();
    if (!config) {
      return NextResponse.json(
        { success: false, error: "Justdial configuration not found. Please configure settings first." },
        { status: 400 }
      );
    }

    const pullUrl = body.pullApiUrl || config.pullApiUrl;
    const clientId = body.pullApiClientId || config.pullApiClientId;
    // Never fall back to the inbound webhook apiKey: it would be sent to a third-party URL.
    const apiKey = str(body.pullApiKey) || decryptField(config.pullApiKey) || "";
    const mobile = body.pullApiMobile || config.pullApiMobile;

    if (!pullUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "Justdial Pull API URL is required. Please provide Pull URL in settings or request body.",
        },
        { status: 400 }
      );
    }

    // Construct request URL
    let targetUrl: URL;
    try {
      targetUrl = new URL(pullUrl);
      if (targetUrl.protocol !== "https:" && targetUrl.protocol !== "http:") throw new Error("bad protocol");
    } catch {
      return NextResponse.json(
        { success: false, error: `Invalid Justdial Pull API URL: ${pullUrl}` },
        { status: 400 }
      );
    }
    if (clientId) targetUrl.searchParams.set("client_id", clientId);
    if (apiKey) targetUrl.searchParams.set("api_key", apiKey);
    if (mobile) targetUrl.searchParams.set("mobile", mobile);
    if (body.startDate) targetUrl.searchParams.set("start_date", body.startDate);
    if (body.endDate) targetUrl.searchParams.set("end_date", body.endDate);

    let rawLeads: any[] = [];

    try {
      const response = await fetch(targetUrl.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}`, "x-api-key": apiKey } : {}),
        },
      });

      const resText = await response.text();
      if (!response.ok) {
        return NextResponse.json(
          {
            success: false,
            error: `Justdial Pull API responded with HTTP ${response.status}: ${resText.slice(0, 300)}`,
          },
          { status: 502 }
        );
      }
      let resJson: any = null;
      try {
        resJson = JSON.parse(resText);
      } catch (_) {
        // Not JSON
      }

      if (resJson) {
        if (Array.isArray(resJson)) {
          rawLeads = resJson;
        } else if (Array.isArray(resJson.data)) {
          rawLeads = resJson.data;
        } else if (Array.isArray(resJson.leads)) {
          rawLeads = resJson.leads;
        } else if (Array.isArray(resJson.result)) {
          rawLeads = resJson.result;
        } else if (typeof resJson === "object" && (resJson.leadid || resJson.mobile || resJson.name)) {
          // Single lead object (not an error/status envelope)
          rawLeads = [resJson];
        }
      }
    } catch (fetchErr: any) {
      console.error("[Justdial Pull API] Fetch error:", fetchErr);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to connect to Justdial Pull API endpoint (${pullUrl}): ${fetchErr.message}`,
        },
        { status: 502 }
      );
    }

    if (!rawLeads || rawLeads.length === 0) {
      // Update lastSyncAt
      await JustdialConfig.updateOne(
        { _id: config._id },
        { $set: { lastSyncAt: new Date() } }
      );

      return NextResponse.json({
        success: true,
        message: "Justdial Pull API connected successfully. No new leads found for the selected period.",
        importedCount: 0,
        duplicatesCount: 0,
        leads: [],
      });
    }

    let importedCount = 0;
    let duplicatesCount = 0;
    const processedLeads: any[] = [];

    for (const lead of rawLeads) {
      try {
        if (!lead || typeof lead !== "object") continue;
        const leadId = str(lead.leadid || lead.lead_id || lead.leadId || lead.id);
        const rawName = str(lead.name || lead.lead_name || lead.caller_name || lead.customer_name);
        const studentFullName = rawName.replace(/^(mr\.?|ms\.?|mrs\.?|dr\.?)\s+/i, "").trim() || "Justdial Inquiry";

        const rawMobile = str(lead.mobile || lead.phone || lead.caller_mobile || lead.customer_mobile);
        const cleanDigits = rawMobile.replace(/\D/g, "").slice(-10);
        const hasValidMobile = cleanDigits.length === 10 && !/^0+$/.test(cleanDigits);
        const primaryPhoneMobile = cleanDigits.length === 10 ? `+91 ${cleanDigits}` : rawMobile;

        const emailAddress = str(lead.email || lead.email_id || lead.customer_email);
        const currentCity = str(lead.city || lead.customer_city || lead.location) || "N/A";
        const justdialCategory = str(lead.category || lead.catname || lead.product || lead.course);
        const queryMessage = str(lead.query || lead.message || lead.remarks || lead.requirement);
        const area = str(lead.area || lead.address || lead.locality);

        // Skip leads already imported (by push webhook or an earlier pull) with the same Justdial lead ID
        if (leadId && (await JustdialLeadLog.exists({ leadId, status: "SUCCESS" }))) {
          duplicatesCount++;
          continue;
        }

        // Check deduplication
        if (hasValidMobile) {
          const existingEnquiry = await Enquiry.findOne({ primaryPhoneMobile });
          if (existingEnquiry) {
            duplicatesCount++;
            await JustdialLeadLog.create({
              timestamp: new Date(),
              sourceType: "PULL_API",
              httpMethod: "GET",
              status: "DUPLICATE",
              leadName: studentFullName,
              mobile: primaryPhoneMobile,
              email: emailAddress,
              category: justdialCategory,
              enquiryId: existingEnquiry.enquiryId,
              rawPayload: lead,
              responseMessage: "Lead already exists in database.",
              ip: "PULL_API",
            });
            continue;
          }
        }

        // Course & Counselor matching
        let matchedCourse = config.defaultCourse || "";
        let matchedCounselor = config.counselorName || "Unassigned";
        let targetBrand = config.defaultBrand || (await getDefaultBrandName());

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

        const remarksParts = [
          leadId ? `Justdial Lead ID: ${leadId}` : null,
          justdialCategory ? `Justdial Category: ${justdialCategory}` : null,
          area ? `Location: ${area}` : null,
          queryMessage ? `Inquiry Note: ${queryMessage}` : null,
        ].filter(Boolean);

        // enquiryId is assigned atomically by the Enquiry pre-save sequence
        const newEnquiry: any = await Enquiry.create({
          // Attributed to the marketing user who set up this connector (if any)
          addedByUserId: (config as any).connectedByUserId || null,
          addedByName: (config as any).connectedByName || "",
          studentFullName,
          date: todayKey(),
          primaryPhoneMobile,
          emailAddress,
          currentCity,
          targetBrand,
          targetCourse: matchedCourse || "General Course",
          targetCourses: matchedCourse ? [matchedCourse] : ["General Course"],
          courses: matchedCourse ? [matchedCourse] : ["General Course"],
          leadSource: config.leadSource || "JustDial",
          status: config.leadStage || "New / Fresh Inquiry",
          assignedCrmAdvisor: matchedCounselor,
          priorityLevel: "High",
          remarks: remarksParts.join(" | ") || "Imported via Justdial Pull API",
          utmSource: "justdial_connector",
          utmMedium: "pull_api",
          utmCampaign: justdialCategory,
          leadTags: ["Justdial", "Pull_API", justdialCategory].filter(Boolean),
        });

        if (config.createFollowUpTask !== false) {
          try {
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 1);
            await Task.create({
              title: `Justdial Pull Lead: ${studentFullName}`,
              description: `New lead imported from Justdial Pull API (${targetBrand} - ${matchedCourse || justdialCategory}). Phone: ${primaryPhoneMobile}.`,
              taskType: "Lead Call",
              linkedStudentName: studentFullName,
              linkedEnquiryId: newEnquiry._id.toString(),
              assignedTo: matchedCounselor,
              priority: "High",
              status: "Pending",
              dueDate,
            });
          } catch (_) {}
        }

        // WhatsApp alerts if configured
        if (config.sendAdminAlertWhatsApp !== false) {
          sendWhatsAppSuperAdminEnquiryAlert({
            studentName: studentFullName,
            studentMobile: primaryPhoneMobile,
            courseName: matchedCourse || "General Course",
            brandName: targetBrand,
            counsellorName: matchedCounselor,
            leadSource: config.leadSource || "JustDial",
            date: newEnquiry.date,
          }).catch(console.error);
        }

        if (config.sendWelcomeWhatsApp !== false && hasValidMobile) {
          sendWhatsAppWelcomeEnquiry({
            studentName: studentFullName,
            mobileNumber: primaryPhoneMobile,
            brandName: targetBrand,
            courseName: matchedCourse || "Course",
          }).catch(console.error);
        }

        await JustdialLeadLog.create({
          timestamp: new Date(),
          sourceType: "PULL_API",
          httpMethod: "GET",
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
          rawPayload: lead,
          responseMessage: "Lead imported via Justdial Pull API successfully",
          ip: "PULL_API",
        });

        importedCount++;
        processedLeads.push(newEnquiry);
      } catch (itemErr: any) {
        console.error("[Justdial Pull API] Item processing error:", itemErr);
      }
    }

    // Update stats in JustdialConfig
    await JustdialConfig.updateOne(
      { _id: config._id },
      {
        $inc: { totalLeadsReceived: importedCount },
        $set: { lastSyncAt: new Date(), lastLeadReceivedAt: importedCount > 0 ? new Date() : config.lastLeadReceivedAt },
      }
    );

    return NextResponse.json({
      success: true,
      message: `✅ Justdial Pull Sync completed! Imported: ${importedCount} leads, Skipped Duplicates: ${duplicatesCount}.`,
      importedCount,
      duplicatesCount,
      totalFetched: rawLeads.length,
      leads: processedLeads,
    });
  } catch (error: any) {
    console.error("Justdial Pull API Sync Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to execute Justdial Pull Sync" },
      { status: 500 }
    );
  }
}
