/**
 * Generates self-contained, print-ready HTML for Official Payment Receipts.
 * Matches the layout, typography, colors, and structure of PaymentReceiptModal.tsx.
 */

export interface ReceiptHtmlData {
  receiptNo: string;
  studentName: string;
  admissionId?: string;
  courseName: string;
  amountPaid: number | string;
  paymentDate: string;
  paymentMode?: string;
  referenceNo?: string;
  particulars?: string;
  brandName?: string;
  brandAddress?: string;
  brandLogoUrl?: string | null;
  companyName?: string;
  companyAddress?: string;
  batch?: string;
  city?: string;
  finalFee?: number | string;
  totalPaidToDate?: number | string;
  remainingBalance?: number | string;
  downpaymentAmount?: number | string;
  downpaymentDueDate?: string | Date;
  customEmiPlan?: any[];
  terms?: string[];
}

function generateBarcodeSvg(): string {
  const bars = [3,1,2,1,1,3,1,1,2,3,1,1,1,2,3,1,3,1,1,2,1,3,2,1,1,1,3,2,1,2,1,1,3,1,2,1,1,3];
  const rects = bars.map((width, idx) => {
    const x = idx * 4 + 2;
    return idx % 2 === 0 ? `<rect x="${x}" y="0" width="${width * 1.5}" height="35" fill="#000000" />` : "";
  }).join("");

  return `<svg width="160" height="35" viewBox="0 0 160 35" style="shape-rendering: crispEdges;">
    <rect width="160" height="35" fill="#ffffff" />
    ${rects}
  </svg>`;
}

/** Brand without an uploaded logo: show its name as a text mark (logos come from the Brands page). */
function getBrandNameMarkHtml(brandName: string): string {
  const safe = String(brandName || "").replace(/[<>&"]/g, "");
  return safe
    ? `<div style="font-size: 15px; font-weight: 900; letter-spacing: 1px; color: #0f172a; max-width: 160px; line-height: 1.15;">${safe}</div>`
    : "";
}

export function generateOfficialReceiptHtml(data: ReceiptHtmlData): string {
  const receiptNo = data.receiptNo || "REC-OFFICIAL";
  const studentName = data.studentName || "Student";
  const admissionId = data.admissionId || "ADM-N/A";
  const courseName = data.courseName || "Course";
  const amountPaidNum = Number(data.amountPaid || 0);
  const amountPaidStr = amountPaidNum.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const paymentDate = data.paymentDate || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const paymentMode = data.paymentMode || "Online";
  const referenceNo = data.referenceNo || "N/A";
  const particulars = data.particulars || "Course Fee / Registration Payment Received";
  const brandName = data.brandName || "";
  const brandAddress = data.brandAddress || "";
  const companyName = data.companyName || "";
  const companyAddress = data.companyAddress || "";
  const batch = data.batch || "General Batch";
  const city = data.city || "";
  const finalFeeNum = Number(data.finalFee || amountPaidNum);
  const finalFeeStr = finalFeeNum.toLocaleString("en-IN");
  const totalPaidNum = Number(data.totalPaidToDate || amountPaidNum);
  const totalPaidStr = totalPaidNum.toLocaleString("en-IN");
  const remainingNum = Number(data.remainingBalance || 0);
  const remainingStr = remainingNum.toLocaleString("en-IN");

  const dpAmount = Number(data.downpaymentAmount || 0);
  const dpDueDate = data.downpaymentDueDate ? new Date(data.downpaymentDueDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "-";
  const isDownpaymentPaid = totalPaidNum >= (amountPaidNum + dpAmount) && dpAmount > 0;

  let logoHtml = "";
  if (data.brandLogoUrl) {
    logoHtml = `<img src="${data.brandLogoUrl}" alt="${brandName}" style="max-height: 48px; max-width: 130px; object-fit: contain;" />`;
  } else {
    logoHtml = getBrandNameMarkHtml(brandName);
  }

  const barcodeSvg = generateBarcodeSvg();

  // Installment schedule rows
  let scheduleRowsHtml = "";
  if (dpAmount > 0) {
    scheduleRowsHtml += `
      <tr style="background: ${isDownpaymentPaid ? '#ecfdf5' : '#fffbeb'};">
        <td style="padding: 6px 8px; font-weight: 600;">${dpDueDate}</td>
        <td style="padding: 6px 8px; font-weight: bold;">Downpayment Amount</td>
        <td style="padding: 6px 8px; text-align: right; font-weight: bold;">₹${dpAmount.toLocaleString("en-IN")}</td>
        <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: ${isDownpaymentPaid ? '#047857' : '#b45309'};">${isDownpaymentPaid ? 'Paid' : 'Pending'}</td>
        <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #e11d48;">${isDownpaymentPaid ? '₹0' : '₹' + dpAmount.toLocaleString("en-IN")}</td>
        <td style="padding: 6px 8px; font-size: 10px; color: #64748b; font-family: monospace;">${isDownpaymentPaid ? 'Downpayment Cleared' : 'Scheduled Due: ' + dpDueDate}</td>
      </tr>
    `;
  }

  if (Array.isArray(data.customEmiPlan) && data.customEmiPlan.length > 0) {
    data.customEmiPlan.forEach((emi: any, idx: number) => {
      const emiAmt = Number(emi.amount || 0);
      const isPaid = emi.isPaid || emi.status === "Paid";
      const emiDate = emi.dueDate ? new Date(emi.dueDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }) : "-";
      scheduleRowsHtml += `
        <tr style="background: ${isPaid ? '#ecfdf5' : 'transparent'};">
          <td style="padding: 6px 8px; font-weight: 600;">${emiDate}</td>
          <td style="padding: 6px 8px; font-weight: bold;">Installment #${idx + 1}</td>
          <td style="padding: 6px 8px; text-align: right; font-weight: bold;">₹${emiAmt.toLocaleString("en-IN")}</td>
          <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: ${isPaid ? '#047857' : '#b45309'};">${isPaid ? 'Paid' : 'Pending'}</td>
          <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #e11d48;">${isPaid ? '₹0' : '₹' + emiAmt.toLocaleString("en-IN")}</td>
          <td style="padding: 6px 8px; font-size: 10px; color: #64748b; font-family: monospace;">${emi.paymentRef || (isPaid ? 'Cleared' : 'Due: ' + emiDate)}</td>
        </tr>
      `;
    });
  } else if (dpAmount === 0) {
    scheduleRowsHtml += `
      <tr>
        <td style="padding: 6px 8px; font-weight: 600;">${paymentDate.split(",")[0] || paymentDate}</td>
        <td style="padding: 6px 8px; font-weight: bold;">${admissionId}</td>
        <td style="padding: 6px 8px; text-align: right; font-weight: bold;">₹${finalFeeStr}</td>
        <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #047857;">Received: ₹${totalPaidStr}</td>
        <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #e11d48;">₹${remainingStr}</td>
        <td style="padding: 6px 8px; font-size: 10px; color: #64748b; font-family: monospace;">${receiptNo} • ${paymentMode}</td>
      </tr>
    `;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fee Receipt - ${receiptNo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
    }
    .receipt-container {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 20px;
      background: #ffffff;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 14px;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 14px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .header-right {
      text-align: right;
    }
    .company-title {
      font-size: 14px;
      font-weight: 900;
      text-transform: uppercase;
      color: #0f172a;
      margin: 0;
      letter-spacing: 0.5px;
    }
    .meta-line {
      font-size: 10px;
      font-weight: 700;
      color: #334155;
      margin-top: 2px;
    }
    .meta-label {
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
    }
    .receipt-number {
      font-size: 13px;
      font-weight: 800;
      color: #059669;
      margin: 0 0 4px 0;
    }
    .two-col-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 14px;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      font-size: 11px;
    }
    .meta-table tr {
      border-bottom: 1px solid #f1f5f9;
    }
    .meta-table td {
      padding: 5px 10px;
    }
    .meta-table tr.odd {
      background: #f8fafc;
    }
    .meta-table td.label {
      font-weight: 600;
      color: #475569;
      width: 45%;
    }
    .meta-table td.val {
      font-weight: 700;
      color: #0f172a;
    }
    .student-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .student-header {
      background: #e2e8f0;
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #334155;
      border-radius: 4px;
      margin-bottom: 6px;
      display: inline-block;
    }
    .student-name {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 2px 0;
    }
    .student-batch {
      font-size: 11px;
      color: #475569;
      font-weight: 600;
      margin: 0;
    }
    .amount-badge {
      margin-top: 10px;
      background: #059669;
      color: #ffffff;
      font-size: 14px;
      font-weight: 800;
      padding: 6px 14px;
      border-radius: 6px;
      text-align: center;
      letter-spacing: 0.5px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      color: #1e293b;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin: 12px 0 6px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      font-size: 11px;
      margin-bottom: 12px;
    }
    .data-table th {
      background: #e2e8f0;
      color: #334155;
      font-weight: 800;
      padding: 6px 8px;
      border-bottom: 1px solid #cbd5e1;
      font-size: 10.5px;
    }
    .data-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .terms-box {
      margin-top: 10px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
      background: #fafafa;
      font-size: 9px;
      color: #475569;
      line-height: 1.35;
    }
    .terms-title {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      color: #334155;
      margin-bottom: 4px;
    }
    .term-item {
      margin-bottom: 3px;
    }
    .term-item b {
      color: #1e293b;
    }
    .signatory-row {
      margin-top: 16px;
      display: flex;
      justify-content: flex-end;
    }
    .signatory-box {
      border-top: 1px solid #64748b;
      padding-top: 4px;
      width: 160px;
      text-align: center;
      font-size: 10px;
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <!-- Header -->
    <div class="header-row">
      <div class="header-left">
        ${logoHtml}
        <div>
          <h1 class="company-title">${companyName}</h1>
          <div class="meta-line">
            <span class="meta-label">Company Address:</span> ${companyAddress}
          </div>
          <div class="meta-line">
            <span class="meta-label">Brand:</span> <span style="color: #047857; font-weight: 900;">${brandName}</span>
            <span style="color: #cbd5e1; margin: 0 4px;">|</span>
            <span class="meta-label">Brand Addr:</span> ${brandAddress}
          </div>
        </div>
      </div>
      <div class="header-right">
        <h3 class="receipt-number">Receipt # ${receiptNo}</h3>
        ${barcodeSvg}
      </div>
    </div>

    <!-- Meta & Received From -->
    <div class="two-col-grid">
      <table class="meta-table">
        <tr class="odd">
          <td class="label">Receipt #</td>
          <td class="val">${receiptNo}</td>
        </tr>
        <tr>
          <td class="label">Receipt Date</td>
          <td class="val">${paymentDate}</td>
        </tr>
        <tr class="odd">
          <td class="label">Received In</td>
          <td class="val">${paymentMode}</td>
        </tr>
        <tr>
          <td class="label">Cheque/Tran. Number</td>
          <td class="val" style="font-family: monospace;">${referenceNo}</td>
        </tr>
        <tr class="odd" style="border-top: 1px solid #cbd5e1;">
          <td class="label" style="font-weight: 800; color: #1e293b;">Received Fee</td>
          <td class="val" style="font-weight: 900; color: #047857;">₹ ${amountPaidStr}</td>
        </tr>
      </table>

      <div class="student-card">
        <div>
          <div class="student-header">Received From :</div>
          <p class="student-name">${studentName}</p>
          <p class="student-batch">Admission Batch : <span style="font-weight: 700; color: #1e293b;">${batch}</span></p>
          <p class="student-batch" style="color: #64748b;">${city}</p>
        </div>
        <div class="amount-badge">
          ₹ ${amountPaidStr}
        </div>
      </div>
    </div>

    <!-- Invoice Details Breakdown -->
    <div class="section-title">Invoice & Fee Particulars Breakdown</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="text-align: left;">Received against Invoice #</th>
          <th style="text-align: left;">Package Details</th>
          <th style="text-align: left;">Particulars / Component</th>
          <th style="text-align: left;">Invoice Date</th>
          <th style="text-align: right;">Agreed Fee</th>
          <th style="text-align: right;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="font-weight: 700; color: #1e293b;">${admissionId}</td>
          <td style="font-weight: 800; color: #0f172a;">${courseName}</td>
          <td style="font-weight: 700; color: #312e81;">${particulars}</td>
          <td>${paymentDate}</td>
          <td style="text-align: right; font-weight: 700;">₹${finalFeeStr}</td>
          <td style="text-align: right; font-weight: 800; color: #047857;">₹${amountPaidStr}</td>
        </tr>
      </tbody>
    </table>

    <!-- Payments Schedule Table -->
    <div class="section-title">Installment & Downpayment Payments Schedule</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="text-align: left;">Due Date</th>
          <th style="text-align: left;">Installment / Item</th>
          <th style="text-align: right;">Due Fee (₹)</th>
          <th style="text-align: right;">Status</th>
          <th style="text-align: right;">Balance Fee (₹)</th>
          <th style="text-align: left;">Payment Ref</th>
        </tr>
      </thead>
      <tbody>
        ${scheduleRowsHtml}
        <tr style="background: #f1f5f9; font-weight: 800; border-top: 1px solid #cbd5e1;">
          <td colspan="2" style="text-align: right; padding-right: 12px;">Total Fee Summary:</td>
          <td style="text-align: right; color: #0f172a;">₹${finalFeeStr}</td>
          <td style="text-align: right; color: #047857;">Paid: ₹${totalPaidStr}</td>
          <td style="text-align: right; color: #e11d48;">Bal: ₹${remainingStr}</td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <!-- Terms & Conditions (11 terms matching the modal) -->
    <div class="terms-box">
      <div class="terms-title">Terms & Conditions:</div>
      ${Array.isArray(data.terms) && data.terms.length > 0 ? (
        data.terms.map(t => `<div class="term-item">${t}</div>`).join("")
      ) : (
        `<div class="term-item"><b>1. Payment Clearance:</b> Payments made through cheque are subject to realization. If a cheque is returned or dishonoured for any reason, the student shall be liable to pay a handling charge of Rs. 500, along with any applicable bank charges.</div>
        <div class="term-item"><b>2. Attendance & Schedule:</b> Students must strictly adhere to the batch timings and schedule allotted by the institute.</div>
        <div class="term-item"><b>3. Transfer Policy:</b> Students enrolled under special schemes, promotional offers or discounts are not eligible for course transfer.</div>
        <div class="term-item"><b>4. Receipt Preservation:</b> Students are advised to keep all fee receipts safely for certificate collection and future verification.</div>
        <div class="term-item"><b>5. Code of Conduct:</b> Students are expected to maintain discipline, decorum, and professional behaviour at all times.</div>
        <div class="term-item"><b>6. Institute Property:</b> Students shall be responsible for proper use of property. Damage due to negligence must be compensated.</div>
        <div class="term-item"><b>7. Fee Policy (Important):</b> All fees paid are non-refundable and non-transferable under any circumstances. Delayed fee payments shall attract a penalty of Rs. 200 per day. Students must not disclose fee structure / discount details to others.</div>
        <div class="term-item"><b>8. Force Majeure:</b> The institute shall not be held liable for any delay or failure in fulfilling its obligations due to circumstances beyond its reasonable control.</div>
        <div class="term-item"><b>9. Course Validity & Curriculum:</b> Course content and combinations may be revised from time to time to meet industry requirements. Rejoining after a break requires joining available program or paying difference.</div>
        <div class="term-item"><b>10. Course Completion Period:</b> Certificate / Diploma Courses: Within 12 months. Master Diploma Programmes: Within 24 months from the date of admission.</div>
        <div class="term-item"><b>11. Course Modification Policy:</b> Upgrades permitted only with prior written approval and fee difference. Downgrades or changes to a lower-value programme are not permitted.</div>`
      )}
    </div>

    <!-- Signatory -->
    <div class="signatory-row">
      <div class="signatory-box">
        Authorised Signatory
      </div>
    </div>
  </div>
</body>
</html>`;
}
