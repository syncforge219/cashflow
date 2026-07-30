import dbConnect from "@/lib/db";
import Brand from "@/models/Brand";

export interface FeeReceiptWhatsAppParams {
  studentName?: string | null;
  mobileNumber: string;
  courseName?: string | null;
  amountPaid: number | string;
  paymentDate?: string | null;
  receiptNo?: string | null;
  receiptUrl?: string | null;
  brandName?: string | null;
  integratedNumber?: string | null;
}

/**
 * Format date to string without time component (e.g. "21 Jul 2026")
 */
export function formatDateOnly(dateInput?: string | null): string {
  if (!dateInput) {
    return new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // If formatted with comma like "21 Jul 2026, 05:30 am", strip time after comma
  if (dateInput.includes(",")) {
    return dateInput.split(",")[0].trim();
  }

  try {
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  } catch (_) {
    // fallback
  }

  return dateInput.trim();
}

/**
 * Format phone number to international format without leading plus (e.g. 919335913286)
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/[^0-9]/g, "");

  if (cleaned.length === 10) {
    cleaned = `91${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith("0")) {
    cleaned = `91${cleaned.slice(1)}`;
  } else if (cleaned.length > 12 && cleaned.startsWith("91")) {
    cleaned = cleaned.slice(0, 12);
  }

  return cleaned;
}

/**
 * Dynamically resolve the MSG91 Integrated WhatsApp Sender Phone Number for a Brand.
 * 1. If explicit integratedNumber parameter is passed, format and return it.
 * 2. If brandName parameter is passed, lookup the Brand in MongoDB and retrieve its phone / whatsappNumber / integratedNumber.
 * 3. Fall back to process.env.MSG91_INTEGRATED_NUMBER if configured.
 */
export async function getIntegratedNumberForBrand(
  brandName?: string | null,
  customIntegratedNum?: string | null
): Promise<string> {
  if (customIntegratedNum) {
    const formatted = formatPhoneNumber(customIntegratedNum);
    if (formatted) return formatted;
  }

  if (brandName) {
    try {
      await dbConnect();
      const cleanBrand = String(brandName).toUpperCase().trim();
      const brandDoc = await Brand.findOne({
        $or: [
          { name: { $regex: new RegExp(`^${cleanBrand.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, "i") } },
          { code: { $regex: new RegExp(`^${cleanBrand.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}$`, "i") } },
        ],
      }).lean();

      if (brandDoc) {
        const rawNum = (brandDoc as any).integratedNumber || (brandDoc as any).whatsappNumber || (brandDoc as any).phone || "";
        if (rawNum) {
          const formatted = formatPhoneNumber(rawNum);
          if (formatted) return formatted;
        }
      }
    } catch (err) {
      console.error(`Error resolving WhatsApp integrated number for brand '${brandName}':`, err);
    }
  }

  const envNum = process.env.MSG91_INTEGRATED_NUMBER || "";
  return envNum ? formatPhoneNumber(envNum) : "";
}

const PUBLIC_PRODUCTION_URL = "https://lead2ledger-git-734957305541.asia-south2.run.app";

export function getPublicPdfBaseUrl(): string {
  const envUrl = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl.replace(/\/$/, "");
  }
  return process.env.MSG91_DEFAULT_PDF_HOST || PUBLIC_PRODUCTION_URL;
}

/**
 * Dispatch MSG91 WhatsApp Outbound Template Message for Fee Receipt
 */
export async function sendWhatsAppFeeReceipt(params: FeeReceiptWhatsAppParams) {
  try {
    const authKey =
      process.env.MSG91_AUTHKEY || "478610A465a065I869fed7fdP1";
    const integratedNumber = await getIntegratedNumberForBrand(params.brandName, params.integratedNumber);

    const formattedPhone = formatPhoneNumber(params.mobileNumber);
    if (!formattedPhone) {
      console.warn("MSG91 WhatsApp Warning: Missing or invalid phone number.");
      return { success: false, error: "Invalid recipient phone number." };
    }

    const rNo = params.receiptNo || "GEN-001";
    const receiptDocUrl =
      params.receiptUrl || `${getPublicPdfBaseUrl()}/api/receipts/${rNo}/pdf?v=${Date.now()}`;
    const filename = `Fee_Receipt_${rNo}.pdf`;
    const formattedAmount = `₹${Number(params.amountPaid || 0).toLocaleString(
      "en-IN",
      { minimumFractionDigits: 2 }
    )}`;

    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "fee",
          language: {
            code: "en",
            policy: "deterministic",
          },
          namespace: null,
          to_and_components: [
            {
              to: [formattedPhone],
              components: {
                header_1: {
                  filename: filename,
                  type: "document",
                  value: receiptDocUrl,
                },
                body_1: {
                  type: "text",
                  value: params.studentName || "Student",
                },
                body_2: {
                  type: "text",
                  value: params.courseName || "Course",
                },
                body_3: {
                  type: "text",
                  value: formattedAmount,
                },
                body_4: {
                  type: "text",
                  value: formatDateOnly(params.paymentDate),
                },
              },
            },
          ],
        },
      },
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authKey) {
      headers["authkey"] = authKey;
    }

    console.log(
      `MSG91 WhatsApp Sending to ${formattedPhone} for Receipt ${params.receiptNo}...`
    );

    const response = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );

    const resText = await response.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(resText);
    } catch (_) {
      // API returned raw text
    }

    console.log("MSG91 WhatsApp Response:", resText);

    if (response.ok) {
      return {
        success: true,
        data: resJson || resText,
      };
    } else {
      return {
        success: false,
        error: resJson?.message || resText || "Failed to send WhatsApp message.",
      };
    }
  } catch (error: any) {
    console.error("MSG91 WhatsApp Error:", error);
    return {
      success: false,
      error: error.message || "Network error during MSG91 WhatsApp trigger.",
    };
  }
}

export interface DailyReportWhatsAppParams {
  adminMobileNumber: string;
  reportData: import("./dailyReportService").DailyReportStats;
  pdfUrl?: string;
  brandName?: string | null;
  integratedNumber?: string | null;
}

/**
 * Dispatch MSG91 WhatsApp Outbound Template Message for Daily Executive Report (template: "dailyreport")
 */
export async function sendWhatsAppDailyReport(params: DailyReportWhatsAppParams) {
  try {
    const authKey =
      process.env.MSG91_AUTHKEY || "478610A465a065I869fed7fdP1";
    const integratedNumber = await getIntegratedNumberForBrand(params.brandName, params.integratedNumber);

    const formattedPhone = formatPhoneNumber(params.adminMobileNumber);
    if (!formattedPhone) {
      console.warn("MSG91 WhatsApp Warning: Invalid admin mobile number.");
      return { success: false, error: "Invalid admin mobile number." };
    }

    const reportPdfUrl =
      params.pdfUrl || `${getPublicPdfBaseUrl()}/api/reports/daily/pdf?v=${Date.now()}`;

    const safeDate = params.reportData.dateStr.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Daily_Report_${safeDate}.pdf`;

    const totalLeads = params.reportData.executiveSummary?.totalLeads?.value ?? 0;
    const demoSessions = params.reportData.conversionFunnel?.demosScheduled ?? 0;
    const admissionsToday = params.reportData.executiveSummary?.admissions?.value ?? 0;
    const todaysCollection = params.reportData.executiveSummary?.totalCollections?.value ?? 0;
    const monthlyCollection = params.reportData.executiveSummary?.totalRevenue?.value ?? 0;
    const pendingFees = params.reportData.executiveSummary?.outstandingFees?.value ?? 0;
    const overdueEmis = params.reportData.pendingFeeSummary?.overdueStudentsCount ?? 0;

    const body1 = params.reportData.dateStr;
    const body2 = `Leads: ${totalLeads} | Demos: ${demoSessions} | Admissions: ${admissionsToday}`;
    const body3 = `Today: ₹${todaysCollection.toLocaleString('en-IN')} | Month: ₹${monthlyCollection.toLocaleString('en-IN')} | Pending: ₹${pendingFees.toLocaleString('en-IN')} | Overdue EMIs: ${overdueEmis}`;

    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "dailyreport",
          language: {
            code: "en",
            policy: "deterministic",
          },
          namespace: null,
          to_and_components: [
            {
              to: [formattedPhone],
              components: {
                header_1: {
                  filename: filename,
                  type: "document",
                  value: reportPdfUrl,
                },
                body_1: {
                  type: "text",
                  value: body1,
                },
                body_2: {
                  type: "text",
                  value: body2,
                },
                body_3: {
                  type: "text",
                  value: body3,
                },
              },
            },
          ],
        },
      },
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authKey) {
      headers["authkey"] = authKey;
    }

    console.log(
      `MSG91 WhatsApp Sending Daily Report to ${formattedPhone}...`
    );

    const response = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );

    const resText = await response.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(resText);
    } catch (_) {}

    console.log("MSG91 Daily Report Primary Response:", resText);

    if (response.ok) {
      return {
        success: true,
        data: resJson || resText,
      };
    } else {
      console.warn("Primary 'dailyreport' MSG91 template failed, retrying with approved 'fee' template fallback...");
      // Fallback with approved document template "fee"
      const fallbackPayload = {
        integrated_number: integratedNumber,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: "fee",
            language: { code: "en", policy: "deterministic" },
            namespace: null,
            to_and_components: [
              {
                to: [formattedPhone],
                components: {
                  header_1: {
                    filename: filename,
                    type: "document",
                    value: reportPdfUrl,
                  },
                  body_1: { type: "text", value: "Executive Daily Report" },
                  body_2: { type: "text", value: `Date: ${params.reportData.dateStr}` },
                  body_3: { type: "text", value: `₹${todaysCollection.toLocaleString('en-IN')}` },
                  body_4: { type: "text", value: params.reportData.dateStr },
                },
              },
            ],
          },
        },
      };

      const fallbackRes = await fetch(
        "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
        {
          method: "POST",
          headers,
          body: JSON.stringify(fallbackPayload),
        }
      );

      const fallbackText = await fallbackRes.text();
      console.log("MSG91 Daily Report Fallback 'fee' Response:", fallbackText);
      let fallbackJson: any = null;
      try { fallbackJson = JSON.parse(fallbackText); } catch (_) {}

      if (fallbackRes.ok) {
        return { success: true, data: fallbackJson || fallbackText };
      }

      return {
        success: false,
        error: resJson?.message || fallbackJson?.message || resText || "Failed to send WhatsApp daily report.",
      };
    }
  } catch (error: any) {
    console.error("MSG91 Daily Report Error:", error);
    return {
      success: false,
      error: error.message || "Network error during MSG91 daily report dispatch.",
    };
  }
}

/**
 * Send Monthly WhatsApp Executive Summary PDF Report via MSG91
 */
export async function sendWhatsAppMonthlyReport(params: {
  adminMobileNumber: string;
  reportData: import("./dailyReportService").DailyReportStats;
  brandName?: string | null;
  integratedNumber?: string | null;
}) {
  try {
    const authKey = process.env.MSG91_AUTHKEY || "478610A465a065I869fed7fdP1";
    const integratedNumber = await getIntegratedNumberForBrand(params.brandName, params.integratedNumber);
    const formattedPhone = formatPhoneNumber(params.adminMobileNumber);
    if (!formattedPhone) {
      return { success: false, error: "Invalid admin mobile number." };
    }
    const reportPdfUrl = `${getPublicPdfBaseUrl()}/api/reports/monthly/pdf?v=${Date.now()}`;
    const filename = `Monthly_Report_${params.reportData.dateStr.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    const totalLeads = params.reportData.executiveSummary?.totalLeads?.value ?? 0;
    const demoSessions = params.reportData.conversionFunnel?.demosScheduled ?? 0;
    const admissionsToday = params.reportData.executiveSummary?.admissions?.value ?? 0;
    const todaysCollection = params.reportData.executiveSummary?.totalCollections?.value ?? 0;
    const monthlyCollection = params.reportData.executiveSummary?.totalRevenue?.value ?? 0;
    const pendingFees = params.reportData.executiveSummary?.outstandingFees?.value ?? 0;
    const overdueEmis = params.reportData.pendingFeeSummary?.overdueStudentsCount ?? 0;

    const body1 = params.reportData.dateStr;
    const body2 = `MTD Leads: ${totalLeads} | MTD Demos: ${demoSessions} | MTD Admissions: ${admissionsToday}`;
    const body3 = `Monthly Revenue: ₹${monthlyCollection.toLocaleString('en-IN')} | Today: ₹${todaysCollection.toLocaleString('en-IN')} | Pending: ₹${pendingFees.toLocaleString('en-IN')} | Overdue EMIs: ${overdueEmis}`;

    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "dailyreport",
          language: {
            code: "en",
            policy: "deterministic",
          },
          namespace: null,
          to_and_components: [
            {
              to: [formattedPhone],
              components: {
                header_1: {
                  filename: filename,
                  type: "document",
                  value: reportPdfUrl,
                },
                body_1: {
                  type: "text",
                  value: body1,
                },
                body_2: {
                  type: "text",
                  value: body2,
                },
                body_3: {
                  type: "text",
                  value: body3,
                },
              },
            },
          ],
        },
      },
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authKey) {
      headers["authkey"] = authKey;
    }

    console.log(`MSG91 WhatsApp Sending Monthly Report to ${formattedPhone}...`);

    const response = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );

    const resText = await response.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(resText);
    } catch (_) {}

    if (response.ok) {
      return {
        success: true,
        data: resJson || resText,
      };
    } else {
      console.warn("Primary 'dailyreport' MSG91 template failed for monthly report, retrying with approved 'fee' template...");
      const fallbackPayload = {
        integrated_number: integratedNumber,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: "fee",
            language: { code: "en", policy: "deterministic" },
            namespace: null,
            to_and_components: [
              {
                to: [formattedPhone],
                components: {
                  header_1: {
                    filename: filename,
                    type: "document",
                    value: reportPdfUrl,
                  },
                  body_1: { type: "text", value: "Executive Monthly MTD Report" },
                  body_2: { type: "text", value: `Month: ${params.reportData.dateStr}` },
                  body_3: { type: "text", value: `₹${monthlyCollection.toLocaleString('en-IN')}` },
                  body_4: { type: "text", value: params.reportData.dateStr },
                },
              },
            ],
          },
        },
      };

      const fallbackRes = await fetch(
        "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
        {
          method: "POST",
          headers,
          body: JSON.stringify(fallbackPayload),
        }
      );

      const fallbackText = await fallbackRes.text();
      console.log("MSG91 Monthly Report Fallback 'fee' Response:", fallbackText);
      let fallbackJson: any = null;
      try { fallbackJson = JSON.parse(fallbackText); } catch (_) {}

      if (fallbackRes.ok) {
        return { success: true, data: fallbackJson || fallbackText };
      }

      return {
        success: false,
        error: resJson?.message || fallbackJson?.message || resText || "Failed to send WhatsApp monthly report.",
      };
    }
  } catch (error: any) {
    console.error("MSG91 Monthly Report Error:", error);
    return {
      success: false,
      error: error.message || "Network error during MSG91 monthly report dispatch.",
    };
  }
}

export interface FeeReminderWhatsAppParams {
  studentName: string;
  mobileNumber: string;
  courseName: string;
  amountDue: number | string;
  dueDate: string | Date;
  brandName?: string | null;
  integratedNumber?: string | null;
}

/**
 * Dispatch MSG91 WhatsApp Fee Reminder Outbound Message for Overdue EMIs
 * Template: "feeremainderstudent"
 * Namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84"
 */
export async function sendWhatsAppEmiReminder(params: FeeReminderWhatsAppParams) {
  try {
    const authKey =
      process.env.MSG91_AUTHKEY || "478610A465a065I869fed7fdP1";
    const integratedNumber = await getIntegratedNumberForBrand(params.brandName, params.integratedNumber);

    const formattedPhone = formatPhoneNumber(params.mobileNumber);
    if (!formattedPhone) {
      console.warn("MSG91 WhatsApp Warning: Missing or invalid phone number for fee reminder.");
      return { success: false, error: "Invalid recipient phone number." };
    }

    const formattedAmount = typeof params.amountDue === "number"
      ? `₹${params.amountDue.toLocaleString("en-IN")}`
      : (String(params.amountDue).startsWith("₹") ? String(params.amountDue) : `₹${params.amountDue}`);

    const formattedDueDate = formatDateOnly(
      typeof params.dueDate === "string" ? params.dueDate : params.dueDate.toISOString()
    );

    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "feeremainderstudent",
          language: {
            code: "en",
            policy: "deterministic",
          },
          namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84",
          to_and_components: [
            {
              to: [formattedPhone],
              components: {
                body_1: {
                  type: "text",
                  value: params.studentName || "Student",
                },
                body_2: {
                  type: "text",
                  value: params.courseName || "Course",
                },
                body_3: {
                  type: "text",
                  value: formattedAmount,
                },
                body_4: {
                  type: "text",
                  value: formattedDueDate,
                },
              },
            },
          ],
        },
      },
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authKey) {
      headers["authkey"] = authKey;
    }

    console.log(
      `MSG91 WhatsApp Sending Overdue Fee Reminder (feeremainderstudent) to ${formattedPhone} for ${params.studentName}...`
    );

    const response = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );

    const resText = await response.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(resText);
    } catch (_) {}

    console.log("MSG91 Fee Reminder Response:", resText);

    if (response.ok) {
      return {
        success: true,
        data: resJson || resText,
      };
    } else {
      return {
        success: false,
        error: resJson?.message || resText || "Failed to send MSG91 WhatsApp fee reminder.",
      };
    }
  } catch (error: any) {
    console.error("MSG91 Fee Reminder Error:", error);
    return {
      success: false,
      error: error.message || "Network error during MSG91 fee reminder dispatch.",
    };
  }
}

export interface CounsellorEmiReminderParams {
  counsellorName: string;
  counsellorMobile: string;
  studentName: string;
  courseName: string;
  studentMobile: string;
  studentEmail: string;
  amountDue: number | string;
  dueDate: string | Date;
  brandName?: string | null;
  integratedNumber?: string | null;
}

/**
 * Dispatch MSG91 WhatsApp Fee Reminder to Counsellor for Overdue EMI
 * Template: "feeremindercounsellor"
 * Namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84"
 * Body params:
 *   body_1: counsellor name
 *   body_2: student name
 *   body_3: course name
 *   body_4: student mobile
 *   body_5: student email
 *   body_6: amount due
 *   body_7: due date
 */
export async function sendWhatsAppCounsellorEmiReminder(params: CounsellorEmiReminderParams) {
  try {
    const authKey = process.env.MSG91_AUTHKEY || "478610A465a065I869fed7fdP1";
    const integratedNumber = await getIntegratedNumberForBrand(params.brandName, params.integratedNumber);

    const formattedPhone = formatPhoneNumber(params.counsellorMobile);
    if (!formattedPhone) {
      console.warn(`[MSG91] Counsellor ${params.counsellorName} has no valid phone — skipping.`);
      return { success: false, error: "Invalid counsellor phone number." };
    }

    const formattedAmount = typeof params.amountDue === "number"
      ? `₹${params.amountDue.toLocaleString("en-IN")}`
      : (String(params.amountDue).startsWith("₹") ? String(params.amountDue) : `₹${params.amountDue}`);

    const formattedDueDate = formatDateOnly(
      typeof params.dueDate === "string" ? params.dueDate : params.dueDate.toISOString()
    );

    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "feeremindercounsellor",
          language: { code: "en", policy: "deterministic" },
          namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84",
          to_and_components: [
            {
              to: [formattedPhone],
              components: {
                body_1: { type: "text", value: params.counsellorName || "Counsellor" },
                body_2: { type: "text", value: params.studentName || "Student" },
                body_3: { type: "text", value: params.courseName || "Course" },
                body_4: { type: "text", value: params.studentMobile || "N/A" },
                body_5: { type: "text", value: params.studentEmail || "N/A" },
                body_6: { type: "text", value: formattedAmount },
                body_7: { type: "text", value: formattedDueDate },
              },
            },
          ],
        },
      },
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authKey) headers["authkey"] = authKey;

    console.log(`[MSG91] Sending Counsellor Reminder (feeremindercounsellor) to ${params.counsellorName} (${formattedPhone}) for student ${params.studentName}...`);

    const response = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      { method: "POST", headers, body: JSON.stringify(payload) }
    );

    const resText = await response.text();
    let resJson: any = null;
    try { resJson = JSON.parse(resText); } catch (_) {}

    console.log("[MSG91] Counsellor Reminder Response:", resText);

    if (response.ok) {
      return { success: true, data: resJson || resText };
    } else {
      return { success: false, error: resJson?.message || resText || "Failed to send counsellor reminder." };
    }
  } catch (error: any) {
    console.error("[MSG91] Counsellor Reminder Error:", error);
    return { success: false, error: error.message || "Network error during counsellor reminder." };
  }
}

export interface DemoReminderWhatsAppParams {
  studentName?: string | null;
  mobileNumber: string;
  courseName?: string | null;
  demoDate: string;
  demoTime: string;
  demoMode: string;
  brandName?: string | null;
  integratedNumber?: string | null;
}

/**
 * Format YYYY-MM-DD to DD-MM-YYYY if applicable
 */
export function formatDDMMYYYY(dateStr?: string | null): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    const [y, m, d] = dateStr.trim().split("-");
    return `${d}-${m}-${y}`;
  }
  return dateStr.trim();
}

/**
 * Dispatch MSG91 WhatsApp Outbound Template Message for Demo Class Reminder
 * Template: "demoreminderforstudent"
 * Components:
 *   body_1: Student Name
 *   body_2: Course Name
 *   body_3: Demo Date
 *   body_4: Demo Time
 *   body_5: Demo Mode
 */
export async function sendWhatsAppDemoReminder(params: DemoReminderWhatsAppParams) {
  try {
    const authKey = process.env.MSG91_AUTHKEY || "478610A465a065I869fed7fdP1";
    const integratedNumber = await getIntegratedNumberForBrand(params.brandName, params.integratedNumber);

    const formattedPhone = formatPhoneNumber(params.mobileNumber);
    if (!formattedPhone) {
      console.warn("MSG91 WhatsApp Warning: Missing or invalid phone number for demo reminder.");
      return { success: false, error: "Invalid recipient phone number." };
    }

    const formattedDate = formatDDMMYYYY(params.demoDate);

    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "demoreminderforstudent",
          language: {
            code: "en",
            policy: "deterministic",
          },
          namespace: null,
          to_and_components: [
            {
              to: [formattedPhone],
              components: {
                body_1: {
                  type: "text",
                  value: params.studentName || "Student",
                },
                body_2: {
                  type: "text",
                  value: params.courseName || "Course",
                },
                body_3: {
                  type: "text",
                  value: formattedDate || "Scheduled Date",
                },
                body_4: {
                  type: "text",
                  value: params.demoTime || "11:00 AM",
                },
                body_5: {
                  type: "text",
                  value: params.demoMode || "Online",
                },
              },
            },
          ],
        },
      },
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authKey) {
      headers["authkey"] = authKey;
    }

    console.log(
      `MSG91 WhatsApp Sending Demo Reminder (demoreminderforstudent) to ${formattedPhone} for ${params.studentName}...`
    );

    const response = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );

    const resText = await response.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(resText);
    } catch (_) {}

    console.log("MSG91 Demo Reminder Response:", resText);

    if (response.ok) {
      return {
        success: true,
        data: resJson || resText,
      };
    } else {
      return {
        success: false,
        error: resJson?.message || resText || "Failed to send WhatsApp demo reminder message.",
      };
    }
  } catch (error: any) {
    console.error("MSG91 Demo Reminder Error:", error);
    return {
      success: false,
      error: error.message || "Network error during MSG91 demo reminder dispatch.",
    };
  }
}

export interface CompanyCapacityAlertParams {
  companyName: string;
  collectedRevenue: number;
  annualCapacityCap: number;
  capacityPercentage: number;
  adminMobileNumber?: string;
  brandName?: string | null;
  integratedNumber?: string | null;
}

/**
 * Dispatch MSG91 WhatsApp Outbound Alert to Admin when a Legal Company hits 95%+ of its Capacity Cap
 */
export async function sendWhatsAppCompanyCapacityAlert(params: CompanyCapacityAlertParams) {
  try {
    const authKey = process.env.MSG91_AUTHKEY || "478610A465a065I869fed7fdP1";
    const integratedNumber = await getIntegratedNumberForBrand(params.brandName, params.integratedNumber);
    const adminPhone = formatPhoneNumber(params.adminMobileNumber || process.env.ADMIN_WHATSAPP_NUMBER || "");

    if (!adminPhone) {
      console.warn("MSG91 Company Capacity Alert Warning: Missing admin phone number.");
      return { success: false, error: "Invalid admin phone number." };
    }

    const formattedCollected = `₹${Number(params.collectedRevenue).toLocaleString("en-IN")}`;
    const formattedCap = `₹${Number(params.annualCapacityCap).toLocaleString("en-IN")}`;
    const pctStr = `${params.capacityPercentage.toFixed(1)}%`;

    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "companycapacityalert",
          language: {
            code: "en",
            policy: "deterministic",
          },
          namespace: null,
          to_and_components: [
            {
              to: [adminPhone],
              components: {
                body_1: {
                  type: "text",
                  value: params.companyName,
                },
                body_2: {
                  type: "text",
                  value: pctStr,
                },
                body_3: {
                  type: "text",
                  value: formattedCollected,
                },
                body_4: {
                  type: "text",
                  value: formattedCap,
                },
              },
            },
          ],
        },
      },
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authKey) {
      headers["authkey"] = authKey;
    }

    console.log(
      `[MSG91 WhatsApp] Company Capacity 95%+ Alert triggered for ${params.companyName} (${pctStr} reached: ${formattedCollected}/${formattedCap}) to Admin ${adminPhone}...`
    );

    const response = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );

    const resText = await response.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(resText);
    } catch (_) {}

    console.log("MSG91 Company Capacity Alert Response:", resText);

    if (response.ok) {
      return {
        success: true,
        data: resJson || resText,
      };
    } else {
      return {
        success: false,
        error: resJson?.message || resText || "Failed to send WhatsApp company capacity alert.",
      };
    }
  } catch (error: any) {
    console.error("MSG91 Company Capacity Alert Error:", error);
    return {
      success: false,
      error: error.message || "Network error during MSG91 capacity alert dispatch.",
    };
  }
}

export interface BrandWelcomeWhatsAppParams {
  studentName?: string | null;
  mobileNumber: string;
  courseName?: string | null;
  brandName?: string | null;
  counsellorName?: string | null;
  admissionId?: string | null;
  integratedNumber?: string | null;
}

/**
 * Dispatch MSG91 WhatsApp Welcome Message to Student upon Admission Creation
 * Sends a warm, official welcome message from the brand celebrating their enrollment.
 */
export async function sendWhatsAppBrandWelcome(params: BrandWelcomeWhatsAppParams) {
  try {
    const authKey = process.env.MSG91_AUTHKEY || "478610A465a065I869fed7fdP1";
    const integratedNumber = await getIntegratedNumberForBrand(params.brandName, params.integratedNumber);

    const formattedPhone = formatPhoneNumber(params.mobileNumber);
    if (!formattedPhone) {
      console.warn("MSG91 Welcome WhatsApp Warning: Invalid mobile number.");
      return { success: false, error: "Invalid mobile number." };
    }

    const brand = params.brandName || "Cadd Mantra";
    const student = params.studentName || "Student";
    const course = params.courseName || "Course";
    const counsellor = params.counsellorName || "Advisor";

    // Primary Template Payload
    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "welcome_onboarding",
          language: { code: "en", policy: "deterministic" },
          to_and_components: [
            {
              to: [formattedPhone],
              components: {
                body_1: { type: "text", value: student },
                body_2: { type: "text", value: course },
                body_3: { type: "text", value: brand },
                body_4: { type: "text", value: counsellor },
              },
            },
          ],
        },
      },
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authKey) headers["authkey"] = authKey;

    console.log(`MSG91 WhatsApp Sending Brand Welcome Message to ${formattedPhone} from ${brand}...`);

    const response = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );

    const resText = await response.text();
    let resJson: any = null;
    try { resJson = JSON.parse(resText); } catch (_) {}

    if (response.ok) {
      return { success: true, data: resJson || resText };
    } else {
      console.warn("Primary 'welcome_onboarding' template notice, attempting approved template fallback...");
      // Fallback with approved template "feeremainderstudent" / "fee"
      const fallbackPayload = {
        integrated_number: integratedNumber,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: "feeremainderstudent",
            language: { code: "en", policy: "deterministic" },
            namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84",
            to_and_components: [
              {
                to: [formattedPhone],
                components: {
                  body_1: { type: "text", value: student },
                  body_2: { type: "text", value: `${course} (${brand})` },
                  body_3: { type: "text", value: "Welcome Enrolled" },
                  body_4: { type: "text", value: new Date().toLocaleDateString("en-IN") },
                },
              },
            ],
          },
        },
      };

      const fallbackRes = await fetch(
        "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
        { method: "POST", headers, body: JSON.stringify(fallbackPayload) }
      );

      const fallbackText = await fallbackRes.text();
      let fallbackJson: any = null;
      try { fallbackJson = JSON.parse(fallbackText); } catch (_) {}

      if (fallbackRes.ok) {
        return { success: true, data: fallbackJson || fallbackText };
      }

      return {
        success: false,
        error: resJson?.message || fallbackJson?.message || resText || "Failed to send welcome WhatsApp message.",
      };
    }
  } catch (error: any) {
    console.error("MSG91 Welcome WhatsApp Error:", error);
    return { success: false, error: error.message || "Network error during welcome WhatsApp dispatch." };
  }
}

export interface EnquiryWelcomeWhatsAppParams {
  studentName?: string | null;
  mobileNumber: string;
  targetCourse?: string | null;
  brandName?: string | null;
  assignedAdvisor?: string | null;
  enquiryId?: string | null;
  integratedNumber?: string | null;
}

/**
 * Dispatch MSG91 WhatsApp Welcome Message to Student upon Enquiry Creation
 * Sends an official, warm welcome greeting & confirmation to the student's WhatsApp number.
 */
export async function sendWhatsAppEnquiryWelcome(params: EnquiryWelcomeWhatsAppParams) {
  try {
    const authKey = process.env.MSG91_AUTHKEY || "478610A465a065I869fed7fdP1";
    const integratedNumber = await getIntegratedNumberForBrand(params.brandName, params.integratedNumber);

    const formattedPhone = formatPhoneNumber(params.mobileNumber);
    if (!formattedPhone) {
      console.warn("MSG91 Enquiry WhatsApp Warning: Invalid student mobile number.");
      return { success: false, error: "Invalid recipient phone number." };
    }

    const student = (params.studentName || "Student").toUpperCase();
    const course = (params.targetCourse || "Course").toUpperCase();
    const brand = (params.brandName || "CADD MANTRA").toUpperCase();
    const advisor = (params.assignedAdvisor || "Academic Counsellor").toUpperCase();

    // Primary Approved MSG91 WhatsApp Template Payload
    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "welcome_enquery",
          language: { code: "en", policy: "deterministic" },
          namespace: null,
          to_and_components: [
            {
              to: [formattedPhone],
              components: {
                body_1: { type: "text", value: student },
                body_2: { type: "text", value: course },
                body_3: { type: "text", value: brand },
                body_4: { type: "text", value: advisor },
              },
            },
          ],
        },
      },
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authKey) headers["authkey"] = authKey;

    console.log(`[MSG91] Sending Enquiry Welcome WhatsApp to ${student} (${formattedPhone}) for course ${course}...`);

    const response = await fetch(
      "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    );

    const resText = await response.text();
    let resJson: any = null;
    try { resJson = JSON.parse(resText); } catch (_) {}

    if (response.ok) {
      return { success: true, data: resJson || resText };
    } else {
      console.warn("[MSG91] Primary 'welcome_enquery' template notice, triggering approved fallback template...");
      // Fallback with universal approved template "feeremainderstudent"
      const fallbackPayload = {
        integrated_number: integratedNumber,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          type: "template",
          template: {
            name: "feeremainderstudent",
            language: { code: "en", policy: "deterministic" },
            namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84",
            to_and_components: [
              {
                to: [formattedPhone],
                components: {
                  body_1: { type: "text", value: student },
                  body_2: { type: "text", value: `${course} (${brand})` },
                  body_3: { type: "text", value: "Enquiry Received" },
                  body_4: { type: "text", value: new Date().toLocaleDateString("en-IN") },
                },
              },
            ],
          },
        },
      };

      const fallbackRes = await fetch(
        "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
        { method: "POST", headers, body: JSON.stringify(fallbackPayload) }
      );

      const fallbackText = await fallbackRes.text();
      let fallbackJson: any = null;
      try { fallbackJson = JSON.parse(fallbackText); } catch (_) {}

      if (fallbackRes.ok) {
        return { success: true, data: fallbackJson || fallbackText };
      }

      return {
        success: false,
        error: resJson?.message || fallbackJson?.message || resText || "Failed to send Enquiry WhatsApp message.",
      };
    }
  } catch (error: any) {
    console.error("[MSG91] Enquiry WhatsApp Error:", error);
    return { success: false, error: error.message || "Network error during Enquiry WhatsApp dispatch." };
  }
}

