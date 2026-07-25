export interface FeeReceiptWhatsAppParams {
  studentName?: string | null;
  mobileNumber: string;
  courseName?: string | null;
  amountPaid: number | string;
  paymentDate?: string | null;
  receiptNo?: string | null;
  receiptUrl?: string | null;
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

const PUBLIC_PRODUCTION_URL = "https://cashflow-git-734957305541.asia-south2.run.app";

export function getPublicPdfBaseUrl(): string {
  const envUrl = process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1") && !envUrl.includes("ngrok")) {
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
    const integratedNumber =
      process.env.MSG91_INTEGRATED_NUMBER || "919335913286";

    const formattedPhone = formatPhoneNumber(params.mobileNumber);
    if (!formattedPhone) {
      console.warn("MSG91 WhatsApp Warning: Missing or invalid phone number.");
      return { success: false, error: "Invalid recipient phone number." };
    }

    const rNo = params.receiptNo || "GEN-001";
    const receiptDocUrl =
      params.receiptUrl || `${getPublicPdfBaseUrl()}/api/receipts/${rNo}/pdf`;
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
}

/**
 * Dispatch MSG91 WhatsApp Outbound Template Message for Daily Executive Report (template: "dailyreport")
 */
export async function sendWhatsAppDailyReport(params: DailyReportWhatsAppParams) {
  try {
    const authKey =
      process.env.MSG91_AUTHKEY || "478610A465a065I869fed7fdP1";
    const integratedNumber =
      process.env.MSG91_INTEGRATED_NUMBER || "919335913286";

    const formattedPhone = formatPhoneNumber(params.adminMobileNumber);
    if (!formattedPhone) {
      console.warn("MSG91 WhatsApp Warning: Invalid admin mobile number.");
      return { success: false, error: "Invalid admin mobile number." };
    }

    const reportPdfUrl =
      params.pdfUrl || `${getPublicPdfBaseUrl()}/api/reports/daily/pdf`;

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

    console.log("MSG91 Daily Report Response:", resText);

    if (response.ok) {
      return {
        success: true,
        data: resJson || resText,
      };
    } else {
      return {
        success: false,
        error: resJson?.message || resText || "Failed to send WhatsApp daily report.",
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
}) {
  try {
    const authKey = process.env.MSG91_AUTHKEY || "478610A465a065I869fed7fdP1";
    const integratedNumber = process.env.MSG91_INTEGRATED_NUMBER || "919335913286";
    const formattedPhone = formatPhoneNumber(params.adminMobileNumber);
    if (!formattedPhone) {
      return { success: false, error: "Invalid admin mobile number." };
    }
    const reportPdfUrl = `${getPublicPdfBaseUrl()}/api/reports/monthly/pdf`;
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
      return {
        success: false,
        error: resJson?.message || resText || "Failed to send WhatsApp monthly report.",
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
    const integratedNumber =
      process.env.MSG91_INTEGRATED_NUMBER || "919335913286";

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
    const integratedNumber = process.env.MSG91_INTEGRATED_NUMBER || "919335913286";

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
    const integratedNumber = process.env.MSG91_INTEGRATED_NUMBER || "919335913286";

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
