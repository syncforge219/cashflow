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
      admSheet.addRow([
        a.admissionId || "N/A",
        a.fullName || "N/A",
        a.mobileNumber || "N/A",
        a.email || "N/A",
        a.course || "N/A",
        a.brand || "Main",
        a.counsellor || "Staff",
        Number(a.finalFee || 0),
        Number(a.amountReceivedToday || 0),
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
