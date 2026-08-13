const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const ExcelJS = require("exceljs");

const MONGODB_URI = "mongodb+srv://syncforgesolutions_db_user:MySecurePassword12@cluster0.jq4axfo.mongodb.net/syncforge_db?retryWrites=true&w=majority&appName=Cluster0";
const SMTP_USER = "sc@caddmantra.com";
const SMTP_PASS = "uqpbmaxoashfpauk";
const SMTP_HOST = "smtp.gmail.com";
const SMTP_PORT = 465;
const DEFAULT_ADMIN_EMAIL = "sc@caddmantra.com";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB successfully!");

  const db = mongoose.connection.db;

  // 1. Find all registered admin accounts
  const users = await db.collection("users").find({}).toArray();
  const adminUsers = users.filter(u => {
    const r = (u.role || "").toLowerCase().trim();
    return r === "admin" || r === "super_admin" || r === "super admin";
  });

  const adminEmails = adminUsers.map(u => (u.email || "").trim()).filter(Boolean);
  const targetEmails = Array.from(new Set([...adminEmails, DEFAULT_ADMIN_EMAIL]));
  console.log("Registered Admin Users found:", adminUsers.map(u => ({ name: u.name, email: u.email, role: u.role })));
  console.log("Target Recipients for Spreadsheet:", targetEmails);

  // 2. Fetch Master Datasets
  const [enquiries, admissions, payments, brands, companies] = await Promise.all([
    db.collection("enquiries").find({}).sort({ createdAt: -1 }).toArray(),
    db.collection("admissions").find({}).sort({ createdAt: -1 }).toArray(),
    db.collection("payments").find({}).sort({ createdAt: -1 }).toArray(),
    db.collection("brands").find({}).sort({ name: 1 }).toArray(),
    db.collection("companies").find({}).sort({ name: 1 }).toArray(),
  ]);

  console.log(`Fetched ${enquiries.length} enquiries, ${admissions.length} admissions, ${payments.length} payments, ${brands.length} brands, ${companies.length} companies.`);

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

  // 3. Build Multi-Sheet Excel Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CoachFlow Academics System";
  workbook.created = now;

  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  const borderThin = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } }
  };

  // ── SHEET 1: EXECUTIVE SUMMARY ──
  const summarySheet = workbook.addWorksheet("Master Executive Summary");
  summarySheet.views = [{ showGridLines: true }];

  summarySheet.addRow(["COACHFLOW ACADEMICS & ADMISSIONS - SUPER MASTER EXECUTIVE REPORT"]);
  summarySheet.getCell("A1").font = { bold: true, size: 14, color: { argb: "FF4F46E5" } };
  summarySheet.addRow([`Report Generated: ${dateStr} at ${timeStr}`, `Total Admissions: ${admissions.length}`, `Total Leads: ${enquiries.length}`]);
  summarySheet.addRow([]);

  const totalBilled = admissions.reduce((sum, a) => sum + (Number(a.finalFee || a.courseFee) || 0), 0);
  const totalCollections = payments.reduce((sum, p) => sum + (Number(p.amountReceived) || 0), 0);
  const totalPending = admissions.reduce((sum, a) => sum + (Number(a.remainingBalance) || 0), 0);

  summarySheet.addRow(["KEY PERFORMANCE INDICATORS (KPI)"]);
  summarySheet.getCell("A4").font = { bold: true, size: 11, color: { argb: "FF0F172A" } };

  const kpiHeader = summarySheet.addRow(["Metric", "Total Count / Amount", "Notes / Breakdown"]);
  kpiHeader.font = headerFont;
  kpiHeader.eachCell(c => { c.fill = headerFill; c.border = borderThin; });

  const kpis = [
    ["Total Enquiries & Inquiries", enquiries.length, "All registered CRM leads"],
    ["Total Confirmed Admissions", admissions.length, "Active enrolled students"],
    ["Total Billed Course Value", `INR ${totalBilled.toLocaleString("en-IN")}`, "Gross academic fees"],
    ["Total Cash & Bank Collections", `INR ${totalCollections.toLocaleString("en-IN")}`, "Total verified collections"],
    ["Total Pending Outstanding Balance", `INR ${totalPending.toLocaleString("en-IN")}`, "Uncollected tuition fees"],
    ["Overall Lead-to-Admission Conversion", `${enquiries.length > 0 ? ((admissions.length / enquiries.length) * 100).toFixed(1) : 0}%`, "Conversion performance"]
  ];

  kpis.forEach(k => {
    const r = summarySheet.addRow(k);
    r.eachCell(c => c.border = borderThin);
  });

  summarySheet.addRow([]);
  summarySheet.addRow([]);

  // Brand Breakdown Table
  summarySheet.addRow(["BRAND PERFORMANCE & REVENUE SPLIT"]);
  summarySheet.getCell(`A${summarySheet.rowCount}`).font = { bold: true, size: 11, color: { argb: "FF0F172A" } };

  const bHeader = summarySheet.addRow(["Brand Name", "Leads", "Admissions", "Conversion Rate", "Billed Revenue", "Collected Revenue", "Pending Balance"]);
  bHeader.font = headerFont;
  bHeader.eachCell(c => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } }; c.border = borderThin; });

  brands.forEach(b => {
    const bNameLower = (b.name || "").toLowerCase().trim();
    const bEnqs = enquiries.filter(e => ((e.targetBrand || e.brand || "").toLowerCase().trim() === bNameLower));
    const bAdms = admissions.filter(a => ((a.brand || a.brandName || "").toLowerCase().trim() === bNameLower));
    const bBilled = bAdms.reduce((s, a) => s + (Number(a.finalFee || a.courseFee) || 0), 0);
    const bPending = bAdms.reduce((s, a) => s + (Number(a.remainingBalance) || 0), 0);
    const bColl = Math.max(0, bBilled - bPending);
    const conv = bEnqs.length > 0 ? `${((bAdms.length / bEnqs.length) * 100).toFixed(1)}%` : "0.0%";

    const r = summarySheet.addRow([b.name, bEnqs.length, bAdms.length, conv, `INR ${bBilled.toLocaleString("en-IN")}`, `INR ${bColl.toLocaleString("en-IN")}`, `INR ${bPending.toLocaleString("en-IN")}`]);
    r.eachCell(c => c.border = borderThin);
  });

  summarySheet.columns.forEach(col => { col.width = 24; });

  // ── SHEET 2: ALL ADMISSIONS REGISTER ──
  const admSheet = workbook.addWorksheet("Admissions Register");
  admSheet.views = [{ showGridLines: true }];

  const admHead = admSheet.addRow([
    "Admission ID", "Student Name", "Mobile Number", "Email", "City",
    "Brand", "Course", "Batch", "Counsellor", "Company Assigned",
    "Course Fee (INR)", "Total Discount (INR)", "Final Fee (INR)",
    "Registration Amount (INR)", "Downpayment Amount (INR)", "Downpayment Due Date",
    "Remaining Balance (INR)", "Fee Status", "Admission Date"
  ]);
  admHead.font = headerFont;
  admHead.eachCell(c => { c.fill = headerFill; c.border = borderThin; });

  admissions.forEach(a => {
    const rem = Number(a.remainingBalance) || 0;
    const finalF = Number(a.finalFee || a.courseFee) || 0;
    let feeStatus = "Pending";
    if (rem === 0 && finalF > 0) feeStatus = "Fully Paid";
    else if (rem < finalF) feeStatus = "Partial";

    const r = admSheet.addRow([
      a.admissionId || "N/A",
      a.fullName || "Student",
      a.mobileNumber || "N/A",
      a.email || "N/A",
      a.city || "N/A",
      a.brand || "N/A",
      a.course || "N/A",
      a.batch || "N/A",
      a.counsellor || "N/A",
      a.companyAssigned || "Unallocated",
      Number(a.courseFee) || 0,
      Number(a.totalDiscount) || 0,
      finalF,
      Number(a.registrationAmount) || 0,
      Number(a.downpaymentAmount) || 0,
      a.downpaymentDueDate ? new Date(a.downpaymentDueDate).toLocaleDateString("en-IN") : "-",
      rem,
      feeStatus,
      a.admissionDate ? new Date(a.admissionDate).toLocaleDateString("en-IN") : new Date(a.createdAt).toLocaleDateString("en-IN")
    ]);
    r.eachCell(c => c.border = borderThin);
  });
  admSheet.columns.forEach(col => { col.width = 18; });

  // ── SHEET 3: ALL PAYMENT RECEIPTS & COLLECTIONS ──
  const pmtSheet = workbook.addWorksheet("Payment Receipts Ledger");
  pmtSheet.views = [{ showGridLines: true }];

  const pmtHead = pmtSheet.addRow([
    "Receipt #", "Student Name", "Brand", "Course", "Amount Received (INR)",
    "Payment Mode", "Transaction / Reference No", "Company", "Payment Date", "Remarks"
  ]);
  pmtHead.font = headerFont;
  pmtHead.eachCell(c => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4338CA" } }; c.border = borderThin; });

  payments.forEach(p => {
    const r = pmtSheet.addRow([
      p.receiptNo || "N/A",
      p.studentName || "Student",
      p.brand || "N/A",
      p.particulars && typeof p.particulars === "string" ? p.particulars : "Fee Payment",
      Number(p.amountReceived) || 0,
      p.paymentMode || "Cash",
      p.referenceNo || "N/A",
      p.company || "Unallocated",
      p.paymentDate ? new Date(p.paymentDate).toLocaleDateString("en-IN") : new Date(p.createdAt).toLocaleDateString("en-IN"),
      p.remarks || "-"
    ]);
    r.eachCell(c => c.border = borderThin);
  });
  pmtSheet.columns.forEach(col => { col.width = 20; });

  // ── SHEET 4: LEADS & ENQUIRIES REGISTER ──
  const enqSheet = workbook.addWorksheet("Leads & Enquiries");
  enqSheet.views = [{ showGridLines: true }];

  const enqHead = enqSheet.addRow([
    "Enquiry ID", "Student Name", "Phone", "Email", "City",
    "Brand", "Target Course", "Assigned Counsellor", "Lead Source",
    "Priority", "Status", "Created Date"
  ]);
  enqHead.font = headerFont;
  enqHead.eachCell(c => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0284C7" } }; c.border = borderThin; });

  enquiries.forEach(e => {
    const r = enqSheet.addRow([
      e.enquiryId || "N/A",
      e.studentFullName || e.fullName || "Lead",
      e.primaryPhoneMobile || e.phone || "N/A",
      e.emailAddress || e.email || "N/A",
      e.currentCity || e.city || "N/A",
      e.targetBrand || e.brand || "N/A",
      e.targetCourse || e.course || "N/A",
      e.assignedCrmAdvisor || e.counsellor || "Unassigned",
      e.leadSource || "Direct",
      e.priorityLevel || "Medium",
      e.status || "Open",
      e.createdAt ? new Date(e.createdAt).toLocaleDateString("en-IN") : "-"
    ]);
    r.eachCell(c => c.border = borderThin);
  });
  enqSheet.columns.forEach(col => { col.width = 18; });

  // 4. Generate Buffer & Send Mail
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `CoachFlow_Master_Executive_Report_${now.toISOString().split("T")[0]}.xlsx`;

  console.log(`Generated Excel workbook (${buffer.length} bytes). Sending email to:`, targetEmails);

  const mailOptions = {
    from: `"CoachFlow Analytics" <${SMTP_USER}>`,
    to: targetEmails.join(", "),
    subject: `📊 CoachFlow Super Master Excel Spreadsheet Report (${dateStr})`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 650px; margin: 0 auto; padding: 28px; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 14px rgba(0,0,0,0.06);">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #f1f5f9;">
          <h2 style="color: #4f46e5; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Master Spreadsheet & Financial Report</h2>
          <p style="color: #64748b; font-size: 13px; margin: 6px 0 0 0; font-weight: 600;">Executive Performance • Admissions • Collections • Leads Register</p>
        </div>

        <p style="font-size: 15px; line-height: 1.5; color: #334155;">Hello Admin,</p>
        <p style="font-size: 14px; line-height: 1.6; color: #475569;">
          Please find attached the official <strong>Super Master Excel Spreadsheet (.xlsx)</strong> generated on <strong>${dateStr} at ${timeStr}</strong> for all registered admin accounts.
        </p>

        <div style="background: #f8fafc; padding: 20px; border-radius: 12px; border-left: 5px solid #4f46e5; margin: 20px 0;">
          <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">Executive Highlights Snapshot</h3>
          <table style="width: 100%; font-size: 13px; line-height: 1.8; color: #334155; border-collapse: collapse;">
            <tr>
              <td style="font-weight: 600; color: #64748b; padding: 4px 0;">Total Confirmed Admissions:</td>
              <td style="font-weight: 800; color: #0f172a; text-align: right; padding: 4px 0;">${admissions.length} Enrolled</td>
            </tr>
            <tr>
              <td style="font-weight: 600; color: #64748b; padding: 4px 0;">Total CRM Enquiries / Leads:</td>
              <td style="font-weight: 800; color: #0f172a; text-align: right; padding: 4px 0;">${enquiries.length} Records</td>
            </tr>
            <tr>
              <td style="font-weight: 600; color: #64748b; padding: 4px 0;">Total Gross Course Fee:</td>
              <td style="font-weight: 800; color: #4f46e5; text-align: right; padding: 4px 0;">₹${totalBilled.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td style="font-weight: 600; color: #64748b; padding: 4px 0;">Total Verified Collections:</td>
              <td style="font-weight: 800; color: #059669; text-align: right; padding: 4px 0;">₹${totalCollections.toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td style="font-weight: 600; color: #64748b; padding: 4px 0;">Total Outstanding Balance:</td>
              <td style="font-weight: 800; color: #e11d48; text-align: right; padding: 4px 0;">₹${totalPending.toLocaleString("en-IN")}</td>
            </tr>
          </table>
        </div>

        <div style="background: #eff6ff; padding: 14px 18px; border-radius: 10px; margin-bottom: 22px; border: 1px solid #bfdbfe;">
          <p style="margin: 0; font-size: 12px; color: #1e40af; line-height: 1.5;">
            📁 <strong>Included Worksheets:</strong><br />
            1. <strong>Master Executive Summary</strong> — Key Metrics & Brand Revenue Breakdown<br />
            2. <strong>Admissions Register</strong> — Student details, batch, fee status, and downpayment schedule<br />
            3. <strong>Payment Receipts Ledger</strong> — Complete transaction audit log with payment modes<br />
            4. <strong>Leads & Enquiries</strong> — CRM pipeline, counselors, and conversion stages
          </p>
        </div>

        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 14px;">
          CoachFlow Systems • Automated Executive Report Attachment: <code>${filename}</code>
        </p>
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
  console.log("SUCCESS! Spreadsheet email successfully sent.");
  console.log("Message ID:", info.messageId);
  console.log("Accepted recipients:", info.accepted);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
