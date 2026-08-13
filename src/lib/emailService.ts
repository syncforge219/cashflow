import nodemailer from "nodemailer";
import ExcelJS from "exceljs";
import { generateReceiptPdfBuffer } from "@/lib/pdfGenerator";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Enquiry from "@/models/Enquiry";
import Payment from "@/models/Payment";
import Company from "@/models/Company";
import Brand from "@/models/Brand";

const SMTP_USER = process.env.SMTP_USER || "sc@caddmantra.com";
const SMTP_PASS = (process.env.SMTP_PASS || "uqpbmaxoashfpauk").replace(/\s+/g, "");
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "sc@caddmantra.com";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

/**
 * Helper: Generate Official Admission Fee Receipt PDF Buffer
 */
export async function generateAdmissionReceiptPDF(admissionData: any): Promise<Buffer> {
  return generateReceiptPdfBuffer({
    receiptNo: `REC-${admissionData.admissionId || "2026-001"}`,
    studentName: admissionData.fullName || "Student",
    admissionId: admissionData.admissionId || "ADM-001",
    courseName: admissionData.course || "Course",
    amountPaid: admissionData.amountReceivedToday || admissionData.registrationAmount || 0,
    paymentDate: admissionData.admissionDate ? new Date(admissionData.admissionDate).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN"),
    paymentMode: admissionData.paymentMode || "UPI",
    referenceNo: admissionData.referenceNo || "N/A",
    brandName: admissionData.brand || "CADD MANTRA",
    companyName: admissionData.companyAssigned || "INSTITUTE OF CREATIVE STUDIES",
    totalFee: admissionData.finalFee || admissionData.courseFee || 0,
    remainingBalance: admissionData.remainingBalance || 0
  });
}

/**
 * 1. Send Admission Confirmation Email to Student
 */
export async function sendAdmissionConfirmationEmail(admissionData: any) {
  try {
    const formatCurrency = (amt: number) => "₹" + Number(amt || 0).toLocaleString("en-IN");
    const formatDate = (d: any) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";

    const customEmiRows = (admissionData.customEmiPlan || []).map((emi: any, idx: number) => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px; font-weight: bold; color: #475569;">Installment ${idx + 1}</td>
        <td style="padding: 10px; color: #334155;">${formatDate(emi.dueDate)}</td>
        <td style="padding: 10px; font-weight: bold; color: #0f172a; text-align: right;">${formatCurrency(emi.amount)}</td>
      </tr>
    `).join("");

    const emiTableSection = admissionData.hasEmi && admissionData.customEmiPlan?.length > 0 ? `
      <div style="margin-top: 24px; background-color: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
        <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 13px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">
          📅 Scheduled EMI Payment Plan
        </h3>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px;">
          <thead>
            <tr style="background-color: #e2e8f0; text-align: left; color: #475569;">
              <th style="padding: 8px 10px; font-size: 11px; text-transform: uppercase;">Installment</th>
              <th style="padding: 8px 10px; font-size: 11px; text-transform: uppercase;">Due Date</th>
              <th style="padding: 8px 10px; font-size: 11px; text-transform: uppercase; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${customEmiRows}
          </tbody>
        </table>
      </div>
    ` : "";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Official Admission Confirmation</title>
      </head>
      <body style="font-family: Arial, Helvetica, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px;">
        
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          
          <!-- Top Brand Header Banner -->
          <tr>
            <td style="background-color: #3b82f6; background-image: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 1px; color: #ffffff; text-transform: uppercase;">COACHFLOW ACADEMICS</h1>
              <p style="margin: 6px 0 0 0; font-size: 12px; font-weight: 600; color: #e0e7ff; text-transform: uppercase; letter-spacing: 2px;">Official Admission Confirmation & Fee Receipt</p>
            </td>
          </tr>

          <!-- Body Content Area -->
          <tr>
            <td style="padding: 28px 24px;">
              <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 12px;">Dear ${admissionData.fullName},</p>
              <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-top: 0; margin-bottom: 20px;">
                Congratulations! We are pleased to confirm that your enrollment for <strong>${admissionData.course}</strong> at CoachFlow Academics has been successfully registered and approved.
              </p>

              <!-- HTML Table for Structured Admission Summary -->
              <table role="presentation" width="100%" cellpadding="10" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
                <tr>
                  <td width="40%" style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Admission ID:</td>
                  <td width="60%" style="font-size: 14px; font-weight: 900; color: #4f46e5; border-bottom: 1px solid #e2e8f0;">${admissionData.admissionId || "Confirmed"}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Course Name:</td>
                  <td style="font-size: 13px; font-weight: 700; color: #1e293b; border-bottom: 1px solid #f1f5f9;">${admissionData.course}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Batch Assigned:</td>
                  <td style="font-size: 13px; font-weight: 700; color: #1e293b; border-bottom: 1px solid #f1f5f9;">${admissionData.batch}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Brand Domain:</td>
                  <td style="font-size: 13px; font-weight: 700; color: #1e293b; border-bottom: 1px solid #f1f5f9;">${admissionData.brand || "Design Gateway"}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Total Final Fee:</td>
                  <td style="font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${formatCurrency(admissionData.finalFee)}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Paid Amount Today:</td>
                  <td style="font-size: 13px; font-weight: 800; color: #16a34a; border-bottom: 1px solid #f1f5f9;">${formatCurrency(admissionData.amountReceivedToday)}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b;">Remaining Balance:</td>
                  <td style="font-size: 13px; font-weight: 800; color: ${admissionData.remainingBalance > 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(admissionData.remainingBalance)}</td>
                </tr>
              </table>

              <!-- Attachment Notice Box -->
              <table role="presentation" width="100%" cellpadding="12" cellspacing="0" border="0" style="background-color: #eff6ff; border-radius: 10px; border: 1px solid #bfdbfe; margin-bottom: 24px;">
                <tr>
                  <td style="font-size: 13px; color: #1e40af; line-height: 1.5;">
                    📎 <strong>PDF Receipt Attached:</strong> Your official fee payment receipt (<code>Official_Fee_Receipt_${admissionData.admissionId}.pdf</code>) is attached to this email for your records.
                  </td>
                </tr>
              </table>

              ${emiTableSection}

              <p style="font-size: 13px; color: #64748b; margin-top: 24px; line-height: 1.6;">
                If you have any questions regarding your class schedule or payment plan, please contact your counselor <strong>${admissionData.counsellor}</strong> or reply to this email.
              </p>

              <p style="font-size: 13px; color: #475569; margin-top: 20px; line-height: 1.5;">
                Warm regards,<br>
                <strong>CoachFlow Academics & Management Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
              CoachFlow Academics & Management System • Automated Admission Engine<br>
              This is an official transaction email sent regarding your academic registration.
            </td>
          </tr>
        </table>

      </body>
      </html>
    `;

    const textContent = `
DEAR ${admissionData.fullName},

Congratulations! Your admission for ${admissionData.course} at CoachFlow Academics has been successfully confirmed.

ADMISSION SUMMARY:
- Admission ID: ${admissionData.admissionId || "Confirmed"}
- Course Name: ${admissionData.course}
- Batch Assigned: ${admissionData.batch}
- Brand Domain: ${admissionData.brand || "Main Academic Domain"}
- Total Final Fee: ${formatCurrency(admissionData.finalFee)}
- Paid Amount Today: ${formatCurrency(admissionData.amountReceivedToday)}
- Remaining Balance: ${formatCurrency(admissionData.remainingBalance)}

ATTACHMENT:
Your official PDF fee payment receipt (Official_Fee_Receipt_${admissionData.admissionId || "ADM"}.pdf) is attached to this email.

If you have any questions, please contact your counselor ${admissionData.counsellor} or reach out to our office.

Warm regards,
CoachFlow Academics Team
`;

    // Generate Official Institution PDF Receipt Attachment Buffer (PDF-1.4 Template)
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = generateReceiptPdfBuffer({
        receiptNo: admissionData.admissionId ? `REC-${admissionData.admissionId}` : `REC-${Date.now().toString().slice(-6)}`,
        studentName: admissionData.fullName,
        admissionId: admissionData.admissionId,
        courseName: admissionData.course,
        amountPaid: admissionData.amountReceivedToday || 0,
        paymentDate: admissionData.admissionDate ? new Date(admissionData.admissionDate).toLocaleDateString("en-IN") : new Date().toLocaleDateString("en-IN"),
        paymentMode: admissionData.paymentMode || "Online",
        referenceNo: admissionData.transactionNo || "N/A",
        brandName: admissionData.brand || "COACHFLOW ACADEMICS",
        brandAddress: "Official Academic Training & Certification Center",
        companyName: admissionData.companyAssigned || "CoachFlow Training Services",
        totalFee: admissionData.finalFee || 0,
        totalPaidToDate: admissionData.amountReceivedToday || 0,
        remainingBalance: admissionData.remainingBalance || 0
      });
    } catch (e) {
      console.warn("[EmailService] generateReceiptPdfBuffer fallback to basic generator:", e);
      pdfBuffer = await generateAdmissionReceiptPDF(admissionData);
    }

    const mailOptions = {
      from: `"CoachFlow Academics" <${SMTP_USER}>`,
      to: admissionData.email,
      subject: `Official Admission Confirmation & Fee Receipt - ${admissionData.fullName} (${admissionData.admissionId || "ADM"})`,
      text: textContent,
      html: htmlContent,
      headers: {
        "X-Mailer": "CoachFlow Academic Engine 2.0",
        "X-Priority": "3 (Normal)",
        "List-Unsubscribe": `<mailto:${SMTP_USER}?subject=Unsubscribe>`,
        "Message-ID": `<admission-${admissionData.admissionId || Date.now()}-${Date.now()}@coachflow.academics>`
      },
      attachments: [
        {
          filename: `Official_Fee_Receipt_${admissionData.admissionId || "ADM"}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Admission Confirmation Email sent to ${admissionData.email}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("[EmailService] Error sending admission confirmation email:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send Fee Payment Receipt Email for Fee Collection Installments
 */
export async function sendFeePaymentReceiptEmail({ payment, admission }: { payment: any; admission: any }) {
  try {
    const studentEmail = (admission.email || "").trim();
    if (!studentEmail) {
      console.log(`[EmailService] No student email provided for fee receipt payment: ${payment.receiptNo}`);
      return { success: false, message: "No student email address" };
    }

    const formatCurrency = (amt: number) => `₹${Number(amt || 0).toLocaleString("en-IN")}`;

    const pdfBuffer = generateReceiptPdfBuffer({
      receiptNo: payment.receiptNo || `REC-${Date.now().toString().slice(-6)}`,
      studentName: admission.fullName,
      admissionId: admission.admissionId,
      courseName: admission.course,
      amountPaid: payment.amountReceived || 0,
      paymentDate: new Date(payment.createdAt || Date.now()).toLocaleDateString("en-IN"),
      paymentMode: payment.paymentMode || "Online",
      referenceNo: payment.referenceNo || "N/A",
      brandName: admission.brand || "COACHFLOW ACADEMICS",
      brandAddress: "Official Academic Training Center",
      companyName: payment.company || admission.companyAssigned || "CoachFlow Training Services",
      totalFee: admission.finalFee || 0,
      totalPaidToDate: (admission.finalFee || 0) - (admission.remainingBalance || 0),
      remainingBalance: admission.remainingBalance || 0
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: Arial, Helvetica, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <tr>
            <td style="background-color: #2563eb; background-image: linear-gradient(135deg, #4f46e5 0%, #2563eb 100%); padding: 30px 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">COACHFLOW ACADEMICS</h1>
              <p style="margin: 6px 0 0 0; font-size: 12px; font-weight: 600; color: #e0e7ff; text-transform: uppercase; letter-spacing: 2px;">Official Fee Payment Receipt</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 24px;">
              <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0;">Dear ${admission.fullName},</p>
              <p style="font-size: 14px; color: #475569; line-height: 1.6;">
                Thank you for your payment. We have successfully received your fee installment of <strong>${formatCurrency(payment.amountReceived)}</strong> for <strong>${admission.course}</strong>.
              </p>
              <table role="presentation" width="100%" cellpadding="10" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; margin: 20px 0;">
                <tr>
                  <td width="40%" style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0;">Receipt Number:</td>
                  <td width="60%" style="font-size: 14px; font-weight: 900; color: #4f46e5; border-bottom: 1px solid #e2e8f0;">${payment.receiptNo}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Amount Received:</td>
                  <td style="font-size: 13px; font-weight: 800; color: #16a34a; border-bottom: 1px solid #f1f5f9;">${formatCurrency(payment.amountReceived)}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Payment Mode / Ref:</td>
                  <td style="font-size: 13px; font-weight: 700; color: #1e293b; border-bottom: 1px solid #f1f5f9;">${payment.paymentMode} (${payment.referenceNo || "N/A"})</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #64748b;">Remaining Balance:</td>
                  <td style="font-size: 13px; font-weight: 800; color: ${admission.remainingBalance > 0 ? '#dc2626' : '#16a34a'};">${formatCurrency(admission.remainingBalance)}</td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="12" cellspacing="0" border="0" style="background-color: #eff6ff; border-radius: 10px; border: 1px solid #bfdbfe; margin-bottom: 24px;">
                <tr>
                  <td style="font-size: 13px; color: #1e40af; line-height: 1.5;">
                    📎 <strong>PDF Receipt Attached:</strong> Your official fee payment receipt (<code>${payment.receiptNo.replace(/[/\\?%*:|"<>]/g, "_")}.pdf</code>) is attached to this email for your records.
                  </td>
                </tr>
              </table>
              <p style="font-size: 13px; color: #64748b; line-height: 1.6;">
                If you have any questions regarding your billing ledger, please contact your counselor <strong>${admission.counsellor}</strong> or reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const textContent = `
DEAR ${admission.fullName},

Thank you for your payment. We have successfully received your fee installment of ${formatCurrency(payment.amountReceived)} for ${admission.course}.

PAYMENT RECEIPT SUMMARY:
- Receipt Number: ${payment.receiptNo}
- Amount Received: ${formatCurrency(payment.amountReceived)}
- Payment Mode: ${payment.paymentMode} (${payment.referenceNo || "N/A"})
- Remaining Balance: ${formatCurrency(admission.remainingBalance)}

ATTACHMENT:
Your official PDF fee receipt (${payment.receiptNo.replace(/[/\\?%*:|"<>]/g, "_")}.pdf) is attached to this email.

Warm regards,
CoachFlow Academics Team
`;

    const mailOptions = {
      from: `"CoachFlow Academics" <${SMTP_USER}>`,
      to: studentEmail,
      subject: `Official Fee Payment Receipt - ${payment.receiptNo} (${admission.fullName})`,
      text: textContent,
      html: htmlContent,
      headers: {
        "X-Mailer": "CoachFlow Academic Engine 2.0",
        "X-Priority": "3 (Normal)",
        "List-Unsubscribe": `<mailto:${SMTP_USER}?subject=Unsubscribe>`,
        "Message-ID": `<receipt-${payment.receiptNo || Date.now()}-${Date.now()}@coachflow.academics>`
      },
      attachments: [
        {
          filename: `Official_Fee_Receipt_${payment.receiptNo.replace(/[/\\?%*:|"<>]/g, "_")}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Fee payment receipt email sent to ${studentEmail}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("[EmailService] Error sending fee payment receipt email:", error);
    return { success: false, error: error.message };
  }
}

/**
 * 2. Send Overdue EMI Reminder Email to Student
 */
export async function sendOverdueEmiReminderEmail(admissionData: any, overdueDetails: { dueDate?: Date; dueAmount?: number; remainingBalance?: number }) {
  try {
    if (!admissionData.email) {
      console.log(`[EmailService] No email for overdue student: ${admissionData.fullName}`);
      return { success: false, message: "No student email address" };
    }

    const formatCurrency = (amt: number) => `₹${Number(amt || 0).toLocaleString("en-IN")}`;
    const formatDate = (d: any) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Overdue";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Overdue EMI Fee Notice</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          
          <!-- Alert Header Banner -->
          <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
            <div style="font-size: 24px; font-weight: 900; letter-spacing: 1px; margin-bottom: 4px;">⚠️ FEE PAYMENT REMINDER</div>
            <div style="font-size: 13px; font-weight: 600; opacity: 0.9; text-transform: uppercase; letter-spacing: 2px;">Overdue EMI Installment Notice</div>
          </div>

          <!-- Body Content -->
          <div style="padding: 32px 24px;">
            <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0;">Dear ${admissionData.fullName},</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6;">
              This is a gentle reminder from CoachFlow Academics that your scheduled course fee EMI installment for <strong>${admissionData.course}</strong> has passed its due date.
            </p>

            <!-- Alert Detail Card -->
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #fca5a5; padding-bottom: 10px; margin-bottom: 10px;">
                <span style="font-size: 12px; font-weight: 700; color: #991b1b; text-transform: uppercase;">Admission ID:</span>
                <span style="font-size: 14px; font-weight: 900; color: #dc2626;">${admissionData.admissionId}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
                <span style="color: #7f1d1d;">Installment Due Date:</span>
                <span style="font-weight: 800; color: #dc2626;">${formatDate(overdueDetails.dueDate)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;">
                <span style="color: #7f1d1d;">Due Installment Amount:</span>
                <span style="font-weight: 900; color: #dc2626;">${formatCurrency(overdueDetails.dueAmount || admissionData.installmentAmount || 0)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-top: 1px solid #fecaca; margin-top: 6px; pt-6px;">
                <span style="color: #7f1d1d;">Total Outstanding Balance:</span>
                <span style="font-weight: 900; color: #991b1b;">${formatCurrency(admissionData.remainingBalance)}</span>
              </div>
            </div>

            <p style="font-size: 13px; color: #475569; line-height: 1.6;">
              Please make the payment at your earliest convenience to avoid any disruption to your course access or late administrative charges. You can make payments via UPI, NetBanking, or directly at our institute accounts office.
            </p>

            <div style="border-top: 1px solid #e2e8f0; margin-top: 32px; padding-top: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
              CoachFlow Academics & Accounts Department • Automated Notification
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"CoachFlow Accounts" <${SMTP_USER}>`,
      to: admissionData.email,
      subject: `⚠️ Important Notice: Overdue Fee Payment Reminder (${admissionData.admissionId})`,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Overdue EMI Email sent to ${admissionData.email}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("[EmailService] Error sending overdue EMI email:", error);
    return { success: false, error: error.message };
  }
}

/**
 * 3. Scan & Trigger Overdue EMI Emails for All Overdue Students
 */
export async function checkAndSendOverdueEmiEmails() {
  try {
    await dbConnect();
    const today = new Date();

    const activeEmiAdmissions = await Admission.find({
      remainingBalance: { $gt: 0 },
      hasEmi: true
    }).lean();

    let emailsSentCount = 0;

    for (const adm of activeEmiAdmissions) {
      if (!adm.email) continue;

      let isOverdue = false;
      let overdueDueDate: Date | undefined = undefined;
      let overdueAmount = adm.installmentAmount || 0;

      if (adm.customEmiPlan && adm.customEmiPlan.length > 0) {
        for (const emi of adm.customEmiPlan) {
          if (emi.dueDate && new Date(emi.dueDate) < today) {
            isOverdue = true;
            overdueDueDate = new Date(emi.dueDate);
            overdueAmount = emi.amount || adm.installmentAmount || 0;
            break;
          }
        }
      } else {
        // Fallback: check admission date + 30 days
        const estimatedDueDate = new Date(adm.admissionDate || adm.createdAt);
        estimatedDueDate.setDate(estimatedDueDate.getDate() + 30);
        if (estimatedDueDate < today) {
          isOverdue = true;
          overdueDueDate = estimatedDueDate;
        }
      }

      if (isOverdue) {
        const res = await sendOverdueEmiReminderEmail(adm, {
          dueDate: overdueDueDate,
          dueAmount: overdueAmount,
          remainingBalance: adm.remainingBalance
        });
        if (res.success) emailsSentCount++;
      }
    }

    return { success: true, emailsSentCount, totalScanned: activeEmiAdmissions.length };
  } catch (error: any) {
    console.error("[EmailService] Error checking overdue EMIs:", error);
    return { success: false, error: error.message };
  }
}

/**
 * 4. Generate & Send Weekly Executive Excel Report to Admin
 */
export async function sendWeeklyExecutiveExcelReport(targetAdminEmail?: string) {
  try {
    await dbConnect();

    const recipient = targetAdminEmail || ADMIN_EMAIL;
    const now = new Date();

    const enquiries = await Enquiry.find({}).sort({ createdAt: -1 }).lean();
    const admissions = await Admission.find({}).sort({ createdAt: -1 }).lean();
    const payments = await Payment.find({}).sort({ createdAt: -1 }).lean();
    const brands = await Brand.find({}).sort({ name: 1 }).lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CoachFlow Academics System";
    workbook.created = now;

    // ── SHEET 1: MASTER EXECUTIVE SUMMARY ──
    const summarySheet = workbook.addWorksheet("Executive Master Summary");

    summarySheet.addRow(["COACHFLOW ACADEMICS - WEEKLY EXECUTIVE PERFORMANCE REPORT"]);
    summarySheet.addRow([`Report Generated On: ${now.toLocaleString("en-IN")}`, `Total Registered Admissions: ${admissions.length}`]);
    summarySheet.addRow([]);

    const totalRevenueBilled = admissions.reduce((sum, a: any) => sum + Number(a.finalFee || 0), 0);
    const totalCollections = payments.reduce((sum, p: any) => sum + Number(p.amountReceived || 0), 0);
    const totalPendingFees = admissions.reduce((sum, a: any) => sum + Number(a.remainingBalance || 0), 0);

    summarySheet.addRow(["KEY EXECUTIVE METRICS SUMMARY"]);
    const kpiHeader = summarySheet.addRow(["Metric", "Current System Value"]);
    kpiHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    kpiHeader.eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } });

    summarySheet.addRow(["Total System Enquiries", enquiries.length]);
    summarySheet.addRow(["Total Admissions Enrolled", admissions.length]);
    summarySheet.addRow(["Total Billed Course Revenue", totalRevenueBilled]);
    summarySheet.addRow(["Total Fee Collections Received", totalCollections]);
    summarySheet.addRow(["Total Outstanding Pending Balance", totalPendingFees]);
    summarySheet.addRow([]);
    summarySheet.addRow([]);

    // Brand Performance Table
    summarySheet.addRow(["BRAND DOMAIN PERFORMANCE BREAKDOWN"]);
    const bHeader = summarySheet.addRow(["Brand Name", "Total Enquiries", "Admissions", "Conversion Rate", "Billed Revenue (INR)"]);
    bHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    bHeader.eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } });

    brands.forEach((b: any) => {
      const bNameLower = (b.name || "").toLowerCase().trim();
      const bEnq = enquiries.filter((e: any) => (e.targetBrand || e.brand || "").toLowerCase().trim() === bNameLower);
      const bAdm = admissions.filter((a: any) => (a.brand || "").toLowerCase().trim() === bNameLower);
      const bRev = bAdm.reduce((sum, a: any) => sum + Number(a.finalFee || 0), 0);
      const convPct = bEnq.length > 0 ? ((bAdm.length / bEnq.length) * 100).toFixed(1) + "%" : "0.0%";

      summarySheet.addRow([b.name, bEnq.length, bAdm.length, convPct, bRev]);
    });
    summarySheet.columns.forEach(col => col.width = 24);

    // ── SHEET 2: ALL ADMISSIONS ROSTER ──
    const admSheet = workbook.addWorksheet("All Admissions Roster");
    const admHeaders = ["Admission ID", "Student Name", "Mobile", "Email", "Course", "Brand", "Counsellor", "Total Fee", "Paid Today", "Remaining Balance", "Payment Mode", "Admission Date"];
    const admHeaderRow = admSheet.addRow(admHeaders);
    admHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    admHeaderRow.eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } });

    admissions.forEach((a: any) => {
      const aPaymentsSum = payments
        .filter((p: any) => p.admissionId?.toString() === a._id?.toString())
        .reduce((sum: number, p: any) => sum + Number(p.amountReceived || 0), 0);
      const paid = aPaymentsSum > 0 ? aPaymentsSum : Number(a.amountReceivedToday || 0);

      admSheet.addRow([
        a.admissionId || "N/A",
        a.fullName || "N/A",
        a.mobileNumber || "N/A",
        a.email || "N/A",
        a.course || "N/A",
        a.brand || "Main",
        a.counsellor || "Staff",
        Number(a.finalFee || 0),
        paid,
        Number(a.remainingBalance || 0),
        a.paymentMode || "Cash",
        a.admissionDate ? new Date(a.admissionDate).toLocaleDateString("en-IN") : "N/A"
      ]);
    });
    admSheet.columns.forEach(col => col.width = 20);

    // ── SHEET 3: OVERDUE EMI & PENDING FEES ──
    const emiSheet = workbook.addWorksheet("Overdue EMI & Pending Fees");
    const emiHeaders = ["Admission ID", "Student Name", "Mobile", "Email", "Course", "Brand", "Counsellor", "Remaining Balance", "Installment Amount", "Custom EMI Count"];
    const emiHeaderRow = emiSheet.addRow(emiHeaders);
    emiHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    emiHeaderRow.eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDC2626" } });

    const pendingAdmissions = admissions.filter((a: any) => Number(a.remainingBalance || 0) > 0);
    pendingAdmissions.forEach((a: any) => {
      emiSheet.addRow([
        a.admissionId || "N/A",
        a.fullName || "N/A",
        a.mobileNumber || "N/A",
        a.email || "N/A",
        a.course || "N/A",
        a.brand || "Main",
        a.counsellor || "Staff",
        Number(a.remainingBalance || 0),
        Number(a.installmentAmount || 0),
        a.customEmiPlan?.length || 0
      ]);
    });
    emiSheet.columns.forEach(col => col.width = 22);

    // Write to Buffer
    const buffer = await workbook.xlsx.writeBuffer();

    const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const filename = `CoachFlow_Weekly_Executive_Report_${now.toISOString().split("T")[0]}.xlsx`;

    const mailOptions = {
      from: `"CoachFlow Analytics" <${SMTP_USER}>`,
      to: recipient,
      subject: `📊 CoachFlow Weekly Executive Performance & Financial Report (${dateStr})`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h2 style="color: #4f46e5; margin-top: 0;">Weekly Executive Academic & Financial Report</h2>
          <p>Dear Admin,</p>
          <p>Please find attached the official <strong>Weekly Executive Performance Report Excel Workbook</strong> containing complete data on admissions, fee collections, brand performance, and overdue EMI balances.</p>
          
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #4f46e5; margin: 16px 0;">
            <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
              <li><strong>Total Admissions:</strong> ${admissions.length} Enrolled</li>
              <li><strong>Total Billed Revenue:</strong> ₹${totalRevenueBilled.toLocaleString("en-IN")}</li>
              <li><strong>Total Cash Collections:</strong> ₹${totalCollections.toLocaleString("en-IN")}</li>
              <li><strong>Outstanding Balance:</strong> ₹${totalPendingFees.toLocaleString("en-IN")}</li>
            </ul>
          </div>

          <p style="font-size: 12px; color: #64748b;">Attached File: <code>${filename}</code></p>
        </div>
      `,
      attachments: [
        {
          filename: filename,
          content: Buffer.from(buffer),
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Weekly Executive Excel Report sent to ${recipient}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId, recipient };
  } catch (error: any) {
    console.error("[EmailService] Error sending weekly Excel report:", error);
    return { success: false, error: error.message };
  }
}

/**
 * 5. Generate & Send Complete Super Master Excel Report to Admin Email
 */
export async function sendMasterExcelReportEmail({
  targetEmail,
  startDate,
  endDate,
}: {
  targetEmail?: string;
  startDate?: string;
  endDate?: string;
} = {}) {
  try {
    await dbConnect();

    const recipient = targetEmail || ADMIN_EMAIL;
    const now = new Date();

    let enquiryQuery: any = {};
    let admissionQuery: any = {};
    let paymentQuery: any = {};

    if (startDate || endDate) {
      const gteDate = startDate ? new Date(startDate) : undefined;
      let lteDate: Date | undefined;
      if (endDate) {
        lteDate = new Date(endDate);
        lteDate.setHours(23, 59, 59, 999);
      }

      if (gteDate || lteDate) {
        const dateFilter: any = {};
        if (gteDate) dateFilter.$gte = gteDate;
        if (lteDate) dateFilter.$lte = lteDate;

        enquiryQuery.createdAt = dateFilter;
        admissionQuery.$or = [
          { admissionDate: dateFilter },
          { $and: [{ admissionDate: { $exists: false } }, { createdAt: dateFilter }] },
          { $and: [{ admissionDate: null }, { createdAt: dateFilter }] },
        ];
        paymentQuery.$or = [
          { paymentDate: dateFilter },
          { $and: [{ paymentDate: { $exists: false } }, { createdAt: dateFilter }] },
        ];
      }
    }

    const [enquiries, admissions, payments, brands, companies] = await Promise.all([
      Enquiry.find(enquiryQuery).sort({ createdAt: -1 }).lean(),
      Admission.find(admissionQuery).sort({ createdAt: -1 }).lean(),
      Payment.find(paymentQuery).populate("admissionId").sort({ createdAt: -1 }).lean(),
      Brand.find({}).sort({ name: 1 }).lean(),
      Company.find({}).sort({ name: 1 }).lean(),
    ]);

    const getCleanPhone = (phone: any): string => {
      if (!phone) return "";
      return String(phone).replace(/\D/g, "").slice(-10);
    };

    // Index payments
    const paymentsByAdmissionId: Record<string, number> = {};
    const paymentsByStudentPhone: Record<string, number> = {};
    const paymentsByStudentName: Record<string, number> = {};

    payments.forEach((p: any) => {
      const amount = Number(p.amountReceived || 0);
      if (!amount) return;

      const admId = p.admissionId?._id?.toString() || (typeof p.admissionId === "string" ? p.admissionId : "");
      if (admId) paymentsByAdmissionId[admId] = (paymentsByAdmissionId[admId] || 0) + amount;

      const admCode = p.admissionId?.admissionId || (typeof p.admissionId === "string" && p.admissionId.startsWith("ADM") ? p.admissionId : "");
      if (admCode) paymentsByAdmissionId[admCode] = (paymentsByAdmissionId[admCode] || 0) + amount;

      const phone = getCleanPhone(p.admissionId?.mobileNumber || p.admissionId?.primaryPhoneMobile || p.phone || p.mobileNumber);
      if (phone) paymentsByStudentPhone[phone] = (paymentsByStudentPhone[phone] || 0) + amount;

      const name = (p.studentName || p.admissionId?.fullName || "").trim().toLowerCase();
      if (name) paymentsByStudentName[name] = (paymentsByStudentName[name] || 0) + amount;
    });

    const getAdmissionFeeCollected = (adm: any): number => {
      if (!adm) return 0;
      const admIdStr = adm._id?.toString() || "";
      const admCode = adm.admissionId || "";
      const phone = getCleanPhone(adm.mobileNumber || adm.primaryPhoneMobile);
      const name = (adm.fullName || "").trim().toLowerCase();

      const fromPayments = (admIdStr ? paymentsByAdmissionId[admIdStr] : 0) ||
                           (admCode ? paymentsByAdmissionId[admCode] : 0) ||
                           (phone ? paymentsByStudentPhone[phone] : 0) ||
                           (name ? paymentsByStudentName[name] : 0) || 0;

      const fromAdmModel = Number(adm.amountReceivedToday || 0) ||
                           ((Number(adm.registrationAmount) || 0) + (Number(adm.downpaymentAmount) || 0)) ||
                           Math.max(0, Number(adm.finalFee || adm.courseFee || 0) - Number(adm.remainingBalance || 0));

      return Math.max(fromPayments, fromAdmModel, 0);
    };

    const getEnquiryFeeCollected = (enq: any): number => {
      if (!enq) return 0;
      const enqIdStr = enq._id?.toString() || "";
      const enqCode = enq.enquiryId || "";
      const phone = getCleanPhone(enq.primaryPhoneMobile || enq.phone || enq.mobile || enq.mobileNumber);
      const name = (enq.studentFullName || enq.fullName || enq.name || "").trim().toLowerCase();

      const matchedAdm = admissions.find((a: any) => {
        const aEnqId = a.enquiryId?._id?.toString() || a.enquiryId?.toString() || "";
        if (aEnqId && (aEnqId === enqIdStr || aEnqId === enqCode)) return true;
        if (a.admissionId && enqCode && a.admissionId === enqCode) return true;
        const aPhone = getCleanPhone(a.mobileNumber || a.primaryPhoneMobile);
        if (phone && aPhone && phone === aPhone) return true;
        const aName = (a.fullName || "").trim().toLowerCase();
        if (name && aName && name === aName && (a.brand || "").toLowerCase() === (enq.targetBrand || enq.brand || "").toLowerCase()) return true;
        return false;
      });

      if (matchedAdm) return getAdmissionFeeCollected(matchedAdm);
      if (phone && paymentsByStudentPhone[phone]) return paymentsByStudentPhone[phone];
      if (name && paymentsByStudentName[name]) return paymentsByStudentName[name];

      const rawFee = parseFloat(String(enq.feesCollected || enq.actualAdmissionFee || enq.expectedConversionFee || "0").replace(/[^0-9.]/g, "")) || 0;
      return rawFee;
    };

    const brandCollectionMap: Record<string, { name: string; brandId: string; enquiries: number; admissions: number; collection: number }> = {};
    brands.forEach((b: any) => {
      const bNameLower = (b.name || "").toLowerCase().trim();
      const bEnquiries = enquiries.filter((e: any) =>
        (e.targetBrand || "").toLowerCase().trim() === bNameLower ||
        (e.brand || "").toLowerCase().trim() === bNameLower
      );
      const bAdmissions = admissions.filter((a: any) =>
        (a.brand || "").toLowerCase().trim() === bNameLower ||
        (a.targetBrand || "").toLowerCase().trim() === bNameLower
      );
      const totalAdmissionsCount = Math.max(
        bEnquiries.filter((e: any) => (e.status || "").toLowerCase() === "admitted").length,
        bAdmissions.length
      );

      const bPaymentsRev = payments.reduce((sum: number, p: any) => {
        const admission = p.admissionId || {};
        const pBrand = (admission.brand || p.brand || "").toLowerCase().trim();
        return pBrand === bNameLower ? sum + Number(p.amountReceived || 0) : sum;
      }, 0);

      const bAdmRev = bAdmissions.reduce((sum: number, a: any) => sum + getAdmissionFeeCollected(a), 0);
      const bRev = Math.max(bPaymentsRev, bAdmRev);

      brandCollectionMap[bNameLower] = {
        name: b.name,
        brandId: b.brandId || "N/A",
        enquiries: bEnquiries.length,
        admissions: totalAdmissionsCount,
        collection: bRev,
      };
    });

    const companyCollectionMap: Record<string, { name: string; bank: string; count: number; collection: number }> = {};
    companies.forEach((comp: any) => {
      const cNameLower = (comp.name || "").toLowerCase().trim();
      const compPayments = payments.filter((p: any) => {
        const admission = p.admissionId || {};
        const pComp = (admission.companyAssigned || p.company || "").toLowerCase().trim();
        return pComp.includes(cNameLower) || cNameLower.includes(pComp);
      });
      const compRev = compPayments.reduce((sum: number, p: any) => sum + Number(p.amountReceived || 0), 0);
      const bankInfo = comp.bankAccount || comp.bankName || comp.bank || comp.bankDetails || "Primary Bank";

      companyCollectionMap[cNameLower] = {
        name: comp.name,
        bank: bankInfo,
        count: compPayments.length,
        collection: compRev,
      };
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Lead2Ledger CRM";
    workbook.created = now;

    // Sheet 1: Master Executive Summary
    const summarySheet = workbook.addWorksheet("Master Executive Summary");
    summarySheet.addRow(["ACADEMIC & CORPORATE MASTER EXECUTIVE SUMMARY REPORT"]);
    summarySheet.addRow([`Report Generated: ${now.toLocaleString("en-IN")}`, `Date Scope: ${startDate || 'Beginning'} to ${endDate || 'Today'}`]);
    summarySheet.addRow([]);

    summarySheet.addRow(["1. ALL BRANDS PERFORMANCE SUMMARY"]);
    const brandHeaders = ["Brand Name", "Brand ID", "Total Enquiries", "Admissions Closed", "Total Collection (INR)"];
    const brandHeaderRow = summarySheet.addRow(brandHeaders);
    brandHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    brandHeaderRow.eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } });

    let globalTotalEnquiries = 0;
    let globalTotalAdmissions = 0;
    let globalTotalRevenue = 0;

    brands.forEach((b: any) => {
      const bNameLower = (b.name || "").toLowerCase().trim();
      const bData = brandCollectionMap[bNameLower] || { enquiries: 0, admissions: 0, collection: 0 };
      globalTotalEnquiries += bData.enquiries;
      globalTotalAdmissions += bData.admissions;
      globalTotalRevenue += bData.collection;
      summarySheet.addRow([b.name, b.brandId || "N/A", bData.enquiries, bData.admissions, bData.collection]);
    });

    const bTotal = summarySheet.addRow(["TOTAL ALL BRANDS", "-", globalTotalEnquiries, globalTotalAdmissions, globalTotalRevenue]);
    bTotal.font = { bold: true };
    summarySheet.addRow([]);
    summarySheet.addRow([]);

    summarySheet.addRow(["2. ALL LEGAL COMPANIES FINANCIAL SUMMARY"]);
    const compHeaders = ["Company Name", "Bank / Account Details", "Receipts Issued", "Total Billed Collections (INR)"];
    const compHeaderRow = summarySheet.addRow(compHeaders);
    compHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    compHeaderRow.eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } });

    let globalCompRev = 0;
    let globalCompCount = 0;
    companies.forEach((comp: any) => {
      const cNameLower = (comp.name || "").toLowerCase().trim();
      const cData = companyCollectionMap[cNameLower] || { count: 0, collection: 0, bank: "Primary Bank" };
      globalCompRev += cData.collection;
      globalCompCount += cData.count;
      summarySheet.addRow([comp.name, cData.bank, cData.count, cData.collection]);
    });
    const cTotal = summarySheet.addRow(["TOTAL ALL COMPANIES", "-", globalCompCount, globalCompRev]);
    cTotal.font = { bold: true };
    summarySheet.columns.forEach(col => col.width = 24);

    // Sheet 2: All Leads Register
    const leadsSheet = workbook.addWorksheet("All Leads Register");
    leadsSheet.addRow(["ALL LEADS & ENQUIRIES COMPREHENSIVE REGISTER"]);
    leadsSheet.addRow([`Export Date: ${now.toLocaleString("en-IN")}`, `Total Leads: ${enquiries.length}`]);
    leadsSheet.addRow([]);

    const lHeader = leadsSheet.addRow([
      "Enquiry ID", "Student Name", "Mobile", "Email", "Target Course",
      "Brand", "Legal Company", "Counsellor", "Lead Source", "Status", "Fees Collected (INR)", "Date Created"
    ]);
    lHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    lHeader.eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } });

    enquiries.forEach((e: any) => {
      leadsSheet.addRow([
        e.enquiryId || "N/A",
        e.studentFullName || e.fullName || "Student",
        e.primaryPhoneMobile || e.phone || "N/A",
        e.emailAddress || e.email || "N/A",
        e.targetCourse || e.course || "General",
        e.targetBrand || e.brand || "N/A",
        e.companyAssigned || "N/A",
        e.assignedCrmAdvisor || "Unassigned",
        e.leadSource || "Direct",
        e.status || "New",
        getEnquiryFeeCollected(e),
        e.createdAt ? new Date(e.createdAt).toLocaleDateString("en-IN") : "N/A"
      ]);
    });
    leadsSheet.columns.forEach(col => col.width = 20);

    // Sheet 3: Admitted Students Register
    const admSheet = workbook.addWorksheet("Admitted Students Register");
    admSheet.addRow(["OFFICIAL ADMITTED STUDENTS & ADMISSIONS REGISTER"]);
    admSheet.addRow([`Export Date: ${now.toLocaleString("en-IN")}`]);
    admSheet.addRow([]);

    const aHeader = admSheet.addRow([
      "Admission ID", "Student Name", "Mobile", "Email", "Enrolled Course",
      "Brand", "Assigned Legal Company", "Counsellor", "Total Fees Collected (INR)", "Status", "Date Admitted"
    ]);
    aHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    aHeader.eachCell(c => c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF10B981" } });

    const seenAdmitted = new Set<string>();
    admissions.forEach((a: any) => {
      const phone = getCleanPhone(a.mobileNumber || a.primaryPhoneMobile);
      if (phone) seenAdmitted.add(phone);
      if (a.admissionId) seenAdmitted.add(a.admissionId);
      admSheet.addRow([
        a.admissionId || "N/A",
        a.fullName || "Student",
        a.mobileNumber || a.primaryPhoneMobile || "N/A",
        a.email || "N/A",
        a.course || "General",
        a.brand || "N/A",
        a.companyAssigned || "N/A",
        a.counsellor || "Staff",
        getAdmissionFeeCollected(a),
        "Admitted",
        a.admissionDate ? new Date(a.admissionDate).toLocaleDateString("en-IN") : "N/A"
      ]);
    });

    enquiries.filter((e: any) => (e.status || "").toLowerCase() === "admitted").forEach((e: any) => {
      const phone = getCleanPhone(e.primaryPhoneMobile || e.phone);
      if (phone && seenAdmitted.has(phone)) return;
      if (e.enquiryId && seenAdmitted.has(e.enquiryId)) return;

      admSheet.addRow([
        e.enquiryId || "N/A",
        e.studentFullName || e.fullName || "Student",
        e.primaryPhoneMobile || e.phone || "N/A",
        e.emailAddress || e.email || "N/A",
        e.targetCourse || e.course || "General",
        e.targetBrand || e.brand || "N/A",
        e.companyAssigned || "N/A",
        e.assignedCrmAdvisor || "Unassigned",
        getEnquiryFeeCollected(e),
        "Admitted",
        e.createdAt ? new Date(e.createdAt).toLocaleDateString("en-IN") : "N/A"
      ]);
    });
    admSheet.columns.forEach(col => col.width = 20);

    const buffer = await workbook.xlsx.writeBuffer();
    const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const filename = `Super_Master_Report_${now.toISOString().split("T")[0]}.xlsx`;

    const mailOptions = {
      from: `"Lead2Ledger Reports" <${SMTP_USER}>`,
      to: recipient,
      subject: `📊 Super Master Academic & Financial Report (${dateStr})`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h2 style="color: #4f46e5; margin-top: 0;">Super Master Academic & Financial Report</h2>
          <p>Dear Admin,</p>
          <p>Please find attached the official <strong>Super Master Report Excel Workbook (.xlsx)</strong> containing comprehensive records for all leads, admitted students, and brand-wise financial collections with real-time fee receipt totals.</p>
          
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #4f46e5; margin: 16px 0;">
            <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
              <li><strong>Total System Leads:</strong> ${enquiries.length} Enquiries</li>
              <li><strong>Total Admitted Students:</strong> ${admissions.length} Registered</li>
              <li><strong>Total Revenue Collected:</strong> ₹${globalTotalRevenue.toLocaleString("en-IN")}</li>
              <li><strong>Legal Companies Billed:</strong> ₹${globalCompRev.toLocaleString("en-IN")}</li>
            </ul>
          </div>

          <p style="font-size: 12px; color: #64748b;">Attached File: <code>${filename}</code></p>
        </div>
      `,
      attachments: [
        {
          filename: filename,
          content: Buffer.from(buffer),
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Super Master Report email sent to ${recipient}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId, recipient, totalRevenue: globalTotalRevenue };
  } catch (error: any) {
    console.error("[EmailService] Error sending Super Master report email:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Send Login OTP Email to User
 */
export async function sendLoginOtpEmail({ email, otp, userName }: { email: string; otp: string; userName: string }) {
  try {
    const mailOptions = {
      from: `"Coach Security" <${SMTP_USER}>`,
      to: email,
      subject: `Your Login OTP: ${otp}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #4f46e5; margin: 0; font-size: 22px; font-weight: 800;">Coach Verification</h2>
            <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Secure Email Login Authentication</p>
          </div>
          <p style="color: #334155; font-size: 15px; line-height: 1.5;">Hello <strong>${userName}</strong>,</p>
          <p style="color: #475569; font-size: 14px; line-height: 1.5;">Your One-Time Password (OTP) for logging in to your Coach account is:</p>
          <div style="margin: 24px 0; text-align: center;">
            <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1e1b4b; background-color: #f1f5f9; padding: 14px 28px; border-radius: 12px; display: inline-block; border: 1.5px solid #cbd5e1;">${otp}</span>
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">This code is valid for <strong>5 minutes</strong>. Do not share this code with anyone.</p>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
          <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">If you did not request this OTP, please ignore this email.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Login OTP email sent to ${email}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error("[EmailService] Error sending login OTP email:", error);
    return { success: false, error: error.message };
  }
}
