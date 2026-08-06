import dbConnect from "@/lib/db";
import Brand from "@/models/Brand";
import User from "@/models/User";

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
  const singlePhone = phone.includes(",") ? phone.split(",")[0].trim() : phone;
  let cleaned = singlePhone.replace(/[^0-9]/g, "");

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
    const cleanBrand = String(brandName).trim();
    const upperBrand = cleanBrand.toUpperCase();

    // 1. Check brand-specific environment variables dynamically
    const brandEnvKey = upperBrand.replace(/[^A-Z0-9]/g, "_");
    const possibleEnvKeys = [
      `MSG91_INTEGRATED_NUMBER_${brandEnvKey}`,
      `MSG91_${brandEnvKey}_INTEGRATED_NUMBER`,
      `MSG91_${brandEnvKey}_NUMBER`,
      `MSG91_INTEGRATED_NUMBER_${brandEnvKey.split("_")[0]}`,
      `MSG91_${brandEnvKey.split("_")[0]}_NUMBER`,
    ];

    for (const key of possibleEnvKeys) {
      if (process.env[key]) {
        const formatted = formatPhoneNumber(process.env[key]!);
        if (formatted) return formatted;
      }
    }

    const envNumRaw = process.env.MSG91_INTEGRATED_NUMBER || "";
    const envNumbers = envNumRaw.split(",").map((n) => n.trim()).filter(Boolean);

    // Specific keyword matching for Design Gateway vs CADD
    if (upperBrand.includes("DESIGN") || upperBrand.includes("GATEWAY")) {
      const designNum =
        process.env.MSG91_INTEGRATED_NUMBER_DESIGN_GATEWAY ||
        process.env.MSG91_DESIGN_GATEWAY_INTEGRATED_NUMBER ||
        process.env.MSG91_DESIGN_GATEWAY_NUMBER ||
        process.env.MSG91_DESIGN_NUMBER ||
        process.env.MSG91_INTEGRATED_NUMBER_DESIGN ||
        (envNumbers.length >= 2 ? envNumbers[1] : "");
      if (designNum) {
        const formatted = formatPhoneNumber(designNum);
        if (formatted) return formatted;
      }
    } else if (upperBrand.includes("CADD") || upperBrand.includes("MANTRA")) {
      const caddNum =
        process.env.MSG91_INTEGRATED_NUMBER_CADD ||
        process.env.MSG91_INTEGRATED_NUMBER_CADD_MANTRA ||
        process.env.MSG91_CADD_NUMBER ||
        process.env.MSG91_CADD_MANTRA_NUMBER ||
        (envNumbers.length >= 1 ? envNumbers[0] : "");
      if (caddNum) {
        const formatted = formatPhoneNumber(caddNum);
        if (formatted) return formatted;
      }
    }

    // 2. Lookup MongoDB Brand collection for brand's registered integrated number
    try {
      await dbConnect();
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

  // 3. Global fallback (1st number is default CADD Mantra)
  const envNum = process.env.MSG91_INTEGRATED_NUMBER || "";
  const envNumbers = envNum.split(",").map((n) => n.trim()).filter(Boolean);
  return envNumbers.length > 0 ? formatPhoneNumber(envNumbers[0]) : "";
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
 * Resolve the MSG91 AuthKey for a specific brand if multi-account / multi-AuthKey setup is configured in .env
 */
export function getAuthKeyForBrand(brandName?: string | null): string {
  const defaultAuthKey = process.env.MSG91_AUTHKEY || "478610A465a065I869fed7fdP1";

  if (brandName) {
    const cleanBrand = String(brandName).trim();
    const upperBrand = cleanBrand.toUpperCase();

    if (upperBrand.includes("DESIGN") || upperBrand.includes("GATEWAY")) {
      const designAuthKey =
        process.env.MSG91_AUTHKEY_DESIGN_GATEWAY ||
        process.env.MSG91_DESIGN_GATEWAY_AUTHKEY ||
        process.env.MSG91_DESIGN_AUTHKEY ||
        process.env.MSG91_AUTHKEY_DESIGN;
      if (designAuthKey) return designAuthKey;
    } else if (upperBrand.includes("CADD") || upperBrand.includes("MANTRA")) {
      const caddAuthKey =
        process.env.MSG91_AUTHKEY_CADD ||
        process.env.MSG91_CADD_AUTHKEY;
      if (caddAuthKey) return caddAuthKey;
    }

    const envAuthKeys = (process.env.MSG91_AUTHKEY || "").split(",").map((k) => k.trim()).filter(Boolean);
    if (upperBrand.includes("DESIGN") || upperBrand.includes("GATEWAY")) {
      if (envAuthKeys.length >= 2) return envAuthKeys[1];
    } else if (upperBrand.includes("CADD") || upperBrand.includes("MANTRA")) {
      if (envAuthKeys.length >= 1) return envAuthKeys[0];
    }
  }

  return defaultAuthKey;
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
  courseName?: string;
  amountDue?: number | string;
  dueDate: string | Date;
  brandName?: string | null;
  integratedNumber?: string | null;
}

/**
 * Dispatch MSG91 WhatsApp Fee Reminder Outbound Message for Student EMI Reminders
 * Template: "feeremainderstudent"
 * Namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84"
 * Variables:
 *   body_1: Student Name
 *   body_2: Next Installment Due Date
 *   body_3: Brand Name
 */
export async function sendWhatsAppEmiReminder(params: FeeReminderWhatsAppParams) {
  try {
    const authKey =
      process.env.MSG91_AUTHKEY || "478610A465a065I869fed7fdP1";

    const brandName = (params.brandName || "CADD MANTRA").trim();
    const integratedNumber = await getIntegratedNumberForBrand(brandName, params.integratedNumber);

    const formattedPhone = formatPhoneNumber(params.mobileNumber);
    if (!formattedPhone) {
      console.warn("MSG91 WhatsApp Warning: Missing or invalid phone number for fee reminder.");
      return { success: false, error: "Invalid recipient phone number." };
    }

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
                  value: formattedDueDate,
                },
                body_3: {
                  type: "text",
                  value: brandName,
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
      `MSG91 WhatsApp Sending Fee Reminder (feeremainderstudent) from ${integratedNumber} to ${formattedPhone} for ${params.studentName} (Due: ${formattedDueDate}, Brand: ${brandName})...`
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
  console.log(`[MSG91] Counsellor fee reminder template (feeremindercounsellor) is disabled per user request.`);
  return {
    success: false,
    message: "Counsellor fee reminder template (feeremindercounsellor) is stopped.",
  };
}

export interface BirthdayReminderWhatsAppParams {
  studentName: string;
  mobileNumber: string;
  brandName?: string | null;
  integratedNumber?: string | null;
}

/**
 * Dispatch MSG91 WhatsApp Outbound Message for Student Birthday Wish
 * Template: "happy_birthday"
 * Namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84"
 * Variables:
 *   body_1: studentName
 *   body_2: brandName
 */
export async function sendWhatsAppBirthdayReminder(params: BirthdayReminderWhatsAppParams) {
  try {
    const authKey =
      process.env.MSG91_AUTHKEY || "478610A465a065I869fed7fdP1";

    const brandName = (params.brandName || "CADD MANTRA").trim();
    const integratedNumber = await getIntegratedNumberForBrand(brandName, params.integratedNumber);

    const formattedPhone = formatPhoneNumber(params.mobileNumber);
    if (!formattedPhone) {
      console.warn("MSG91 WhatsApp Warning: Missing or invalid phone number for birthday reminder.");
      return { success: false, error: "Invalid recipient phone number." };
    }

    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "happy_birthday",
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
                  value: brandName,
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
      `MSG91 WhatsApp Sending Birthday Wish (happy_birthday) from ${integratedNumber} to ${formattedPhone} for ${params.studentName} (Brand: ${brandName})...`
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

    console.log("MSG91 Birthday Wish Response:", resText);

    if (response.ok) {
      return {
        success: true,

        data: resJson || resText,
      };
    } else {
      return {
        success: false,
        error: resJson?.message || resText || "Failed to send MSG91 WhatsApp birthday wish.",
      };
    }
  } catch (error: any) {
    console.error("MSG91 Birthday Wish Error:", error);
    return {
      success: false,
      error: error.message || "Network error during MSG91 birthday wish dispatch.",
    };
  }
}










export interface WelcomeEnquiryWhatsAppParams {
  studentName: string;
  mobileNumber: string;


  courseName: string;




  brandName?: string | null;
  integratedNumber?: string | null;
}







/**
 * Dispatch MSG91 WhatsApp Outbound Welcome Message upon New Enquiry Creation
 * For Design Gateway:
 *   Template: "welcome_enquery"
 *   Namespace: "d637ec85_020e_4aa6_8042_f5db99837ab0"
 *   Sender: 916307244317 (2nd number in .env)
 *   Variables: body_1 (studentName), body_2 (brandName), body_3 (courseName), body_4 (brandName)
 *
 * For CADD Mantra / Default:
 *   Template: "welcome_enquiry"
 *   Namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84"
 *   Sender: 1st number in .env
 */
export async function sendWhatsAppWelcomeEnquiry(params: WelcomeEnquiryWhatsAppParams) {
  try {
    const authKey =
      process.env.MSG91_AUTHKEY ? process.env.MSG91_AUTHKEY.split(",")[0].trim() : "478610A465a065I869fed7fdP1";

    const brandName = (params.brandName || "CADD MANTRA").trim();
    const upperBrand = brandName.toUpperCase();
    const isDesignGateway = upperBrand.includes("DESIGN") || upperBrand.includes("GATEWAY");

    const envNumbers = (process.env.MSG91_INTEGRATED_NUMBER || "919335913286").split(",");
    const formattedPhone = formatPhoneNumber(params.mobileNumber);
    if (!formattedPhone) {
      console.warn("MSG91 WhatsApp Warning: Missing or invalid phone number for welcome enquiry.");
      return { success: false, error: "Invalid recipient phone number." };
    }

    const defaultNumber = isDesignGateway ? (envNumbers[1] || "916307244317") : envNumbers[0];
    const integratedNumber = await getIntegratedNumberForBrand(brandName, params.integratedNumber || defaultNumber);


    const studentName = (params.studentName || "Student").trim();
    const courseName = (params.courseName || "Course").trim();

    let templateName = "welcome_enquiry";
    let namespace = "610ca09d_29b3_4193_8bab_18e0fab26f84";
    let components: Record<string, { type: string; value: string }> = {
      body_1: { type: "text", value: studentName },
      body_2: { type: "text", value: brandName },
      body_3: { type: "text", value: courseName },
      body_4: { type: "text", value: brandName },
      body_5: { type: "text", value: brandName },
    };

    if (isDesignGateway) {
      templateName = "welcome_enquery";
      namespace = "d637ec85_020e_4aa6_8042_f5db99837ab0";
      components = {
        body_1: { type: "text", value: studentName },
        body_2: { type: "text", value: brandName },
        body_3: { type: "text", value: courseName },
        body_4: { type: "text", value: brandName },
      };
    }

    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: templateName,
          language: {
            code: "en",
            policy: "deterministic",
          },
          namespace: namespace,
          to_and_components: [
            {
              to: [formattedPhone],
              components: components,
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
      `MSG91 WhatsApp Sending Welcome Enquiry (template: ${templateName}, namespace: ${namespace}) from ${integratedNumber} to ${formattedPhone} for ${studentName} (Brand: ${brandName}, Course: ${courseName})...`
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

    console.log("MSG91 Welcome Enquiry Response:", resText);

    if (response.ok) {
      return {
        success: true,
        data: resJson || resText,
      };
    } else {
      return {
        success: false,
        error: resJson?.message || resText || "Failed to send MSG91 WhatsApp welcome enquiry message.",
      };
    }
  } catch (error: any) {
    console.error("MSG91 Welcome Enquiry Error:", error);
    return {
      success: false,
      error: error.message || "Network error during MSG91 welcome enquiry dispatch.",
    };
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
 * Namespace: null
 *
 * For Design Gateway → sender: 916307244317 (2nd slot in MSG91_INTEGRATED_NUMBER)
 * For CADD Mantra / Default → sender: 919335913286 (1st slot)
 *
 * Components:
 *   body_1: Student Name
 *   body_2: Course Name
 *   body_3: Demo Date  (DD-MM-YYYY)
 *   body_4: Demo Time
 *   body_5: Demo Mode
 */
export async function sendWhatsAppDemoReminder(params: DemoReminderWhatsAppParams) {
  try {
    const authKey =
      process.env.MSG91_AUTHKEY ? process.env.MSG91_AUTHKEY.split(",")[0].trim() : "478610A465a065I869fed7fdP1";

    const brandName = (params.brandName || "").trim();
    const upperBrand = brandName.toUpperCase();
    const isDesignGateway = upperBrand.includes("DESIGN") || upperBrand.includes("GATEWAY");

    // Pick sender number: DG uses 2nd slot (916307244317), others use 1st slot
    const envNumbers = (process.env.MSG91_INTEGRATED_NUMBER || "919335913286").split(",");
    const defaultIntegratedNumber = isDesignGateway
      ? (envNumbers[1]?.trim() || "916307244317")
      : (envNumbers[0]?.trim() || "919335913286");
    const integratedNumber = params.integratedNumber || defaultIntegratedNumber;

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

export interface TeacherDemoAlertParams {
  teacherName: string;
  teacherMobile: string;
  demoDate: string;
  courseName: string;
  brandName?: string | null;
  integratedNumber?: string | null;
}

/**
 * Dispatch MSG91 WhatsApp Demo Alert to Teacher (Design Gateway)
 * Template: "teacher_demo"
 * Sender: 916307244317
 * Namespace: null
 * Variables:
 *   body_1: teacherName
 *   body_2: demoDate
 *   body_3: courseName
 */
export async function sendWhatsAppTeacherDemoAlert(params: TeacherDemoAlertParams) {
  try {
    const authKey =
      process.env.MSG91_AUTHKEY ? process.env.MSG91_AUTHKEY.split(",")[0].trim() : "478610A465a065I869fed7fdP1";

    const formattedPhone = formatPhoneNumber(params.teacherMobile);
    if (!formattedPhone) {
      console.warn("MSG91 Teacher Demo Alert Warning: Missing or invalid teacher phone number.");
      return { success: false, error: "Invalid teacher phone number." };
    }

    // Resolve integrated_number — prefer 2nd env slot (Design Gateway sender: 916307244317)
    const envNumbers = (process.env.MSG91_INTEGRATED_NUMBER || "919335913286").split(",");
    const defaultIntegratedNumber = envNumbers[1]?.trim() || "916307244317";
    const integratedNumber = params.integratedNumber || defaultIntegratedNumber;

    const teacherName = (params.teacherName || "Teacher").trim();
    const courseName = (params.courseName || "Course").trim();
    const formattedDate = formatDDMMYYYY(params.demoDate);

    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "teacher_demo",
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
                  value: teacherName,
                },
                body_2: {
                  type: "text",
                  value: formattedDate || params.demoDate,
                },
                body_3: {
                  type: "text",
                  value: courseName,
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
      `MSG91 WhatsApp Sending Teacher Demo Alert (teacher_demo) from ${integratedNumber} to ${formattedPhone} for teacher ${teacherName}, date ${formattedDate}, course ${courseName}...`
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

    console.log("MSG91 Teacher Demo Alert Response:", resText);

    if (response.ok) {
      return {
        success: true,
        data: resJson || resText,
      };
    } else {
      return {
        success: false,
        error: resJson?.message || resText || "Failed to send MSG91 WhatsApp teacher demo alert.",
      };
    }
  } catch (error: any) {
    console.error("MSG91 Teacher Demo Alert Error:", error);
    return {
      success: false,
      error: error.message || "Network error during MSG91 teacher demo alert dispatch.",
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
      error: error.message || "Network error during MSG91 capacity alert dispatch.t dispatch.",
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
 * Dispatch MSG91 WhatsApp Student Admission Message upon Admission Creation
 * Template: "admission"
 * Namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84"
 * Recipient: Admitted Student
 * Variables:
 *   body_1: studentname
 *   body_2: brand name
 *   body_3: coursename
 *   body_4: brandname
 *   body_5: brandnumber (1st env number for CADD Mantra, 2nd env number for Design Gateway)
 */
export async function sendWhatsAppBrandWelcome(params: BrandWelcomeWhatsAppParams) {
  try {
    const authKey =
      process.env.MSG91_AUTHKEY ? process.env.MSG91_AUTHKEY.split(",")[0].trim() : "478610A465a065I869fed7fdP1";

    const integratedNumber = await getIntegratedNumberForBrand(params.brandName, params.integratedNumber);

    const formattedPhone = formatPhoneNumber(params.mobileNumber);
    if (!formattedPhone) {
      console.warn("MSG91 Welcome WhatsApp Warning: Invalid mobile number.");
      return { success: false, error: "Invalid mobile number." };
    }

    const brand = (params.brandName || "CADD Mantra").trim();
    const student = (params.studentName || "Student").trim();
    const course = (params.courseName || "Course").trim();
    const brandNumber = integratedNumber || "919335913286";

    // Primary Template Payload using template "admission"
    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "admission",
          language: { code: "en", policy: "deterministic" },
          namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84",
          to_and_components: [
            {
              to: [formattedPhone],
              components: {
                body_1: { type: "text", value: student },
                body_2: { type: "text", value: brand },
                body_3: { type: "text", value: course },
                body_4: { type: "text", value: brand },
                body_5: { type: "text", value: brandNumber },
              },
            },
          ],
        },
      },
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (authKey) headers["authkey"] = authKey;

    console.log(`MSG91 WhatsApp Sending Student Admission Message (template: admission) to ${formattedPhone} from ${brand} (${integratedNumber})...`);

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
      console.warn("Primary 'admission' template notice, attempting approved template fallback...");
      // Fallback with approved template "welcome_onboarding" / "feeremainderstudent"
      const fallbackPayload = {
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
                  body_4: { type: "text", value: params.counsellorName || "Advisor" },
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
        error: resJson?.message || fallbackJson?.message || resText || "Failed to send student admission WhatsApp message.",
      };
    }
  } catch (error: any) {
    console.error("MSG91 Welcome WhatsApp Error:", error);
    return { success: false, error: error.message || "Network error during welcome WhatsApp dispatch." };
  }
}

export const sendWhatsAppStudentAdmissionNotice = sendWhatsAppBrandWelcome;

export interface CompanyLimit80AlertParams {
  superAdminName?: string;
  superAdminMobile?: string;
  companyName: string;
  brandName?: string | null;
  integratedNumber?: string | null;
}

/**
 * Dispatch MSG91 WhatsApp Outbound Alert ONLY to Super Admin when a Legal Company hits 80%+ Capacity Limit
 * Template: "limit"
 * Namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84"
 * Variables:
 *   body_1: Super Admin Name
 *   body_2: Company Name
 */
export async function sendWhatsAppCompanyLimit80Alert(params: CompanyLimit80AlertParams) {
  try {
    const authKey =
      process.env.MSG91_AUTHKEY || "478610A465a065I869fed7fdP1";

    let superAdminPhone = formatPhoneNumber(
      params.superAdminMobile || process.env.ADMIN_WHATSAPP_NUMBER || process.env.ADMIN_PHONE || ""
    );
    let superAdminName = (params.superAdminName || "Super Admin").trim();

    if (!superAdminPhone) {
      try {
        await dbConnect();
        const superAdminUser = await User.findOne({
          role: { $in: ["super admin", "super_admin"] },
          phone: { $exists: true, $ne: "" },
        }).lean();

        if (superAdminUser && (superAdminUser as any).phone) {
          superAdminPhone = formatPhoneNumber((superAdminUser as any).phone);
          if ((superAdminUser as any).name) {
            superAdminName = (superAdminUser as any).name;
          }
        }
      } catch (dbErr) {
        console.error("[MSG91 80% Limit Alert] Error fetching super admin user:", dbErr);
      }
    }

    if (!superAdminPhone) {
      const envNumRaw = process.env.MSG91_INTEGRATED_NUMBER || "";
      superAdminPhone = formatPhoneNumber(envNumRaw.split(",")[0] || "919335913286");
    }

    if (!superAdminPhone) {
      console.warn("MSG91 Company 80% Limit Alert Warning: Missing super admin phone number.");
      return { success: false, error: "Invalid super admin phone number." };
    }

    const integratedNumber = await getIntegratedNumberForBrand(params.brandName, params.integratedNumber);

    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "limit",
          language: {
            code: "en",
            policy: "deterministic",
          },
          namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84",
          to_and_components: [
            {
              to: [superAdminPhone],
              components: {
                body_1: {
                  type: "text",
                  value: superAdminName,
                },
                body_2: {
                  type: "text",
                  value: params.companyName || "Company",
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
      `MSG91 WhatsApp Sending Company 80% Capacity Limit Alert (template: limit) from ${integratedNumber} to Super Admin ${superAdminName} (${superAdminPhone}) for Company: ${params.companyName}...`
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

    console.log("MSG91 Company 80% Limit Alert Response:", resText);

    if (response.ok) {
      return {
        success: true,
        data: resJson || resText,
      };
    } else {
      return {
        success: false,
        error: resJson?.message || resText || "Failed to send MSG91 WhatsApp company limit alert.",
      };
    }
  } catch (error: any) {
    console.error("MSG91 Company 80% Limit Alert Error:", error);
    return {
      success: false,
      error: error.message || "Network error during MSG91 company limit alert dispatch.",
    };
  }
}

export interface SuperAdminEnquiryAlertParams {
  studentName?: string | null;
  studentMobile: string;
  courseName?: string | null;
  brandName?: string | null;
  counsellorName?: string | null;
  leadSource?: string | null;
  date?: string | null;
  time?: string | null;
  superAdminMobile?: string | null;
}

/**
 * Dispatch MSG91 WhatsApp Outbound Alert ONLY to Super Admin when a New Enquiry is Registered
 * Template: "enquiry_msg"
 * Namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84"
 * Variables:
 *   body_1: studentname
 *   body_2: studentmobile
 *   body_3: cousename (course name)
 *   body_4: brandname
 *   body_5: counsellorname
 *   body_6: leadsource
 *   body_7: date
 *   body_8: time
 * Sender integrated_number: ALWAYS 1st number in process.env.MSG91_INTEGRATED_NUMBER
 */
export async function sendWhatsAppSuperAdminEnquiryAlert(params: SuperAdminEnquiryAlertParams) {
  try {
    const authKey =
      process.env.MSG91_AUTHKEY ? process.env.MSG91_AUTHKEY.split(",")[0].trim() : "478610A465a065I869fed7fdP1";

    // 1st number in .env for sender integrated_number
    const envNumRaw = process.env.MSG91_INTEGRATED_NUMBER || "919335913286";
    const envNumbers = envNumRaw.split(",").map((n) => n.trim()).filter(Boolean);
    const integratedNumber = envNumbers.length > 0 ? formatPhoneNumber(envNumbers[0]) : "919335913286";

    // Resolve Super Admin Phone number
    let superAdminPhone = formatPhoneNumber(
      params.superAdminMobile || process.env.SUPER_ADMIN_PHONE || process.env.ADMIN_WHATSAPP_NUMBER || process.env.ADMIN_PHONE || ""
    );

    if (!superAdminPhone) {
      try {
        await dbConnect();
        const superAdminUser = await User.findOne({
          role: { $regex: /^super[\s_]?admin$/i },
          phone: { $exists: true, $ne: "" },
        }).lean();

        if (superAdminUser && (superAdminUser as any).phone) {
          superAdminPhone = formatPhoneNumber((superAdminUser as any).phone);
        }
      } catch (dbErr) {
        console.error("[MSG91 Super Admin Enquiry Alert] Error fetching super admin user:", dbErr);
      }
    }

    if (!superAdminPhone) {
      // Fallback to integrated number if no super admin phone found
      superAdminPhone = integratedNumber;
    }

    if (!superAdminPhone) {
      console.warn("MSG91 Super Admin Enquiry Alert Warning: Missing super admin phone number.");
      return { success: false, error: "Invalid super admin phone number." };
    }

    const now = new Date();
    const currentDateStr = params.date
      ? formatDateOnly(params.date)
      : now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const currentTimeStr = params.time
      ? params.time.trim()
      : now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

    const studentName = (params.studentName || "Student").trim();
    const studentMobile = (params.studentMobile || "N/A").trim();
    const courseName = (params.courseName || "General Course").trim();
    const brandName = (params.brandName || "CADD Mantra").trim();
    const counsellorName = (params.counsellorName || "Unassigned").trim();
    const leadSource = (params.leadSource || "Website").trim();

    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "enquiry_msg",
          language: {
            code: "en",
            policy: "deterministic",
          },
          namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84",
          to_and_components: [
            {
              to: [superAdminPhone],
              components: {
                body_1: {
                  type: "text",
                  value: studentName,
                },
                body_2: {
                  type: "text",
                  value: studentMobile,
                },
                body_3: {
                  type: "text",
                  value: courseName,
                },
                body_4: {
                  type: "text",
                  value: brandName,
                },
                body_5: {
                  type: "text",
                  value: counsellorName,
                },
                body_6: {
                  type: "text",
                  value: leadSource,
                },
                body_7: {
                  type: "text",
                  value: currentDateStr,
                },
                body_8: {
                  type: "text",
                  value: currentTimeStr,
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
      `MSG91 WhatsApp Sending Super Admin New Enquiry Alert (template: enquiry_msg) from 1st env number (${integratedNumber}) to Super Admin (${superAdminPhone}) for Student: ${studentName}...`
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

    console.log("MSG91 Super Admin Enquiry Alert Response:", resText);

    if (response.ok) {
      return {
        success: true,
        data: resJson || resText,
      };
    } else {
      return {
        success: false,
        error: resJson?.message || resText || "Failed to send MSG91 WhatsApp super admin enquiry alert.",
      };
    }
  } catch (error: any) {
    console.error("MSG91 Super Admin Enquiry Alert Error:", error);
    return {
      success: false,
      error: error.message || "Network error during MSG91 super admin enquiry alert dispatch.",
    };
  }
}

export interface SuperAdminAdmissionAlertParams {
  studentName?: string | null;
  admissionNumber?: string | null;
  courseName?: string | null;
  brandName?: string | null;
  counsellorName?: string | null;
  amountPaid?: number | string | null;
  registrationAmount?: number | string | null;
  downpaymentAmount?: number | string | null;
  paymentMode?: string | null;
  date?: string | null;
  time?: string | null;
  superAdminMobile?: string | null;
}

/**
 * Dispatch MSG91 WhatsApp Outbound Alert ONLY to Super Admin when a New Admission is Registered
 * Template: "admission_msg"
 * Namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84"
 * Variables:
 *   body_1: studentname
 *   body_2: admissionnumber
 *   body_3: cousername
 *   body_4: brandname
 *   body_5: counsellorname
 *   body_6: amonutpaid (total amount paid at admission)
 *   body_7: registration & downpayment breakdown / details
 *   body_8: date
 *   body_9: time
 * Sender integrated_number: ALWAYS 1st number in process.env.MSG91_INTEGRATED_NUMBER
 */
export async function sendWhatsAppSuperAdminAdmissionAlert(params: SuperAdminAdmissionAlertParams) {
  try {
    const authKey =
      process.env.MSG91_AUTHKEY ? process.env.MSG91_AUTHKEY.split(",")[0].trim() : "478610A465a065I869fed7fdP1";

    // 1st number in .env for sender integrated_number
    const envNumRaw = process.env.MSG91_INTEGRATED_NUMBER || "919335913286";
    const envNumbers = envNumRaw.split(",").map((n) => n.trim()).filter(Boolean);
    const integratedNumber = envNumbers.length > 0 ? formatPhoneNumber(envNumbers[0]) : "919335913286";

    // Resolve Super Admin Phone number
    let superAdminPhone = formatPhoneNumber(
      params.superAdminMobile || process.env.SUPER_ADMIN_PHONE || process.env.ADMIN_WHATSAPP_NUMBER || process.env.ADMIN_PHONE || ""
    );

    if (!superAdminPhone) {
      try {
        await dbConnect();
        const superAdminUser = await User.findOne({
          role: { $regex: /^super[\s_]?admin$/i },
          phone: { $exists: true, $ne: "" },
        }).lean();

        if (superAdminUser && (superAdminUser as any).phone) {
          superAdminPhone = formatPhoneNumber((superAdminUser as any).phone);
        }
      } catch (dbErr) {
        console.error("[MSG91 Super Admin Admission Alert] Error fetching super admin user:", dbErr);
      }
    }

    if (!superAdminPhone) {
      superAdminPhone = integratedNumber;
    }

    if (!superAdminPhone) {
      console.warn("MSG91 Super Admin Admission Alert Warning: Missing super admin phone number.");
      return { success: false, error: "Invalid super admin phone number." };
    }

    const now = new Date();
    const currentDateStr = params.date
      ? formatDateOnly(params.date)
      : now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const currentTimeStr = params.time
      ? params.time.trim()
      : now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

    const studentName = (params.studentName || "Student").trim();
    const admissionNumber = (params.admissionNumber || "N/A").trim();
    const courseName = (params.courseName || "General Course").trim();
    const brandName = (params.brandName || "CADD Mantra").trim();
    const counsellorName = (params.counsellorName || "Advisor").trim();

    const regAmt = Number(params.registrationAmount) || 0;
    const dpAmt = Number(params.downpaymentAmount) || 0;
    const rawAmtPaid = params.amountPaid !== undefined && params.amountPaid !== null
      ? Number(params.amountPaid)
      : (regAmt + dpAmt);

    const formattedAmountPaid = `₹${rawAmtPaid.toLocaleString("en-IN")}`;

    let breakdownStr = `Reg: ₹${regAmt.toLocaleString("en-IN")} | DP: ₹${dpAmt.toLocaleString("en-IN")}`;
    if (regAmt === 0 && dpAmt === 0) {
      breakdownStr = params.paymentMode ? `Mode: ${params.paymentMode}` : formattedAmountPaid;
    }

    const payload = {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "admission_msg",
          language: {
            code: "en",
            policy: "deterministic",
          },
          namespace: "610ca09d_29b3_4193_8bab_18e0fab26f84",
          to_and_components: [
            {
              to: [superAdminPhone],
              components: {
                body_1: {
                  type: "text",
                  value: studentName,
                },
                body_2: {
                  type: "text",
                  value: admissionNumber,
                },
                body_3: {
                  type: "text",
                  value: courseName,
                },
                body_4: {
                  type: "text",
                  value: brandName,
                },
                body_5: {
                  type: "text",
                  value: counsellorName,
                },
                body_6: {
                  type: "text",
                  value: formattedAmountPaid,
                },
                body_7: {
                  type: "text",
                  value: breakdownStr,
                },
                body_8: {
                  type: "text",
                  value: currentDateStr,
                },
                body_9: {
                  type: "text",
                  value: currentTimeStr,
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
      `MSG91 WhatsApp Sending Super Admin New Admission Alert (template: admission_msg) from 1st env number (${integratedNumber}) to Super Admin (${superAdminPhone}) for Student: ${studentName}...`
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

    console.log("MSG91 Super Admin Admission Alert Response:", resText);

    if (response.ok) {
      return {
        success: true,
        data: resJson || resText,
      };
    } else {
      return {
        success: false,
        error: resJson?.message || resText || "Failed to send MSG91 WhatsApp super admin admission alert.",
      };
    }
  } catch (error: any) {
    console.error("MSG91 Super Admin Admission Alert Error:", error);
    return {
      success: false,
      error: error.message || "Network error during MSG91 super admin admission alert dispatch.",
    };
  }
}
