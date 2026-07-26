import { DailyBiReportData } from "./dailyBiService";

export interface ReceiptPdfData {
  receiptNo: string;
  studentName: string;
  admissionId?: string;
  courseName: string;
  amountPaid: number | string;
  paymentDate: string;
  paymentMode?: string;
  referenceNo?: string;
  brandName?: string;
  brandAddress?: string;
  companyName?: string;
  totalFee?: number | string;
  totalPaidToDate?: number | string;
  remainingBalance?: number | string;
}

export type DailyReportPdfData = DailyBiReportData;

function escapePdfText(text: any): string {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "");
}

/**
 * Generate 2-Page Native PDF Buffer (PDF-1.4 format) for Fee Receipts
 */
export function generateReceiptPdfBuffer(data: ReceiptPdfData): Buffer {
  const brand = (data.brandName || "CADD MANTRA").replace(/[()]/g, "");
  const brandAddress = (data.brandAddress || "G 11 , Murli Bhawan , 10- A, Ashok Marg , Lucknow").replace(/[()]/g, "");
  const student = (data.studentName || "Student").replace(/[()]/g, "");
  const course = (data.courseName || "Course").replace(/[()]/g, "");
  const company = (data.companyName || "M/s CT ENTERPRISES").replace(/[()]/g, "");
  const mode = (data.paymentMode || "Online").replace(/[()]/g, "");
  const ref = (data.referenceNo || "N/A").replace(/[()]/g, "");
  const receiptNo = (data.receiptNo || "CM/CTE/2024/1230").replace(/[()]/g, "");
  const payDate = (data.paymentDate || new Date().toLocaleDateString("en-IN")).replace(/[()]/g, "");

  const amountVal = Number(data.amountPaid || 0);
  const amountStr = amountVal.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  
  const finalFeeVal = Number(data.totalFee || amountVal);
  const totalPaidVal = Number(data.totalPaidToDate || amountVal);
  const remainingVal = Number(data.remainingBalance || 0);

  // --- PAGE 1 CONTENT STREAM ---
  const page1Lines = [
    // Header Left Logo + Company Details
    `BT /F2 18 Tf 0.72 0.11 0.11 rg 50 765 Td (CM) Tj ET`,
    `BT /F2 8.5 Tf 0.1 0.1 0.1 rg 50 750 Td (${brand}) Tj ET`,

    `BT /F2 12 Tf 0.1 0.1 0.1 rg 135 778 Td (${company}) Tj ET`,
    `BT /F2 9 Tf 0.1 0.5 0.2 rg 135 764 Td (${brand}) Tj ET`,
    `BT /F1 7.5 Tf 0.4 0.4 0.4 rg 135 752 Td (${brandAddress}) Tj ET`,

    // Header Right
    `BT /F2 11 Tf 0.1 0.6 0.2 rg 360 780 Td (Receipt # ${receiptNo}) Tj ET`,
    
    // Barcode Vector Graphic
    `0.1 0.1 0.1 rg`,
    `360 742 180 25 re f`,
    `1 1 1 rg`,
    `365 742 3 25 re f`, `372 742 2 25 re f`, `378 742 4 25 re f`,
    `386 742 2 25 re f`, `392 742 5 25 re f`, `402 742 3 25 re f`,
    `410 742 2 25 re f`, `416 742 4 25 re f`, `425 742 3 25 re f`,
    `433 742 5 25 re f`, `442 742 2 25 re f`, `450 742 4 25 re f`,
    `460 742 3 25 re f`, `470 742 2 25 re f`, `480 742 5 25 re f`,

    // Top Divider Line
    fillRoundedRect("0.85 0.85 0.85", 50, 730, 495, 1, 4),

    // Left Column Meta Box
    fillRoundedRect("0.96 0.96 0.96", 50, 625, 240, 95, 4),
    strokeRoundedRect("0.85 0.85 0.85", 50, 625, 240, 95, 4),
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 55 707 Td (Receipt #) Tj ET`,
    `BT /F2 8.5 Tf 0.1 0.1 0.1 rg 140 707 Td (${receiptNo}) Tj ET`,
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 55 688 Td (Receipt Date) Tj ET`,
    `BT /F1 8.5 Tf 0.1 0.1 0.1 rg 140 688 Td (${payDate}) Tj ET`,
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 55 669 Td (Received In) Tj ET`,
    `BT /F1 8.5 Tf 0.1 0.1 0.1 rg 140 669 Td (${mode}) Tj ET`,
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 55 650 Td (Cheque/Tran. Number) Tj ET`,
    `BT /F1 8.5 Tf 0.1 0.1 0.1 rg 140 650 Td (${ref}) Tj ET`,
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 55 631 Td (Received Fee) Tj ET`,
    `BT /F2 8.5 Tf 0.1 0.1 0.1 rg 140 631 Td (${amountStr}) Tj ET`,

    // Right Column Received From & Green Pill
    fillRoundedRect("0.85 0.85 0.85", 305, 700, 240, 20, 4),
    `BT /F2 9 Tf 0.2 0.2 0.2 rg 310 706 Td (Received From :) Tj ET`,
    `BT /F2 10 Tf 0.1 0.1 0.1 rg 305 684 Td (${student}) Tj ET`,
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 305 669 Td (Admission Batch : Lucknow) Tj ET`,
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 305 654 Td (Lucknow) Tj ET`,

    // Solid Green Amount Pill
    fillRoundedRect("0.15 0.68 0.32", 305, 625, 240, 22, 4),
    `BT /F2 12 Tf 1 1 1 rg 400 632 Td (INR ${amountStr}) Tj ET`,

    // Invoice Details Section
    `BT /F2 10 Tf 0.1 0.1 0.1 rg 50 605 Td (Invoice Details) Tj ET`,
    fillRoundedRect("0.82 0.82 0.82", 50, 585, 495, 18, 4),
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 55 590 Td (Received against Invoice #) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 160 590 Td (Package Details) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 300 590 Td (Fees Details) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 370 590 Td (Invoice Date) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 440 590 Td (Due Fee) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 490 590 Td (Received Fee) Tj ET`,

    `BT /F1 8 Tf 0.2 0.2 0.2 rg 55 570 Td (566) Tj ET`,
    `BT /F1 8 Tf 0.2 0.2 0.2 rg 160 570 Td (${course}) Tj ET`,
    `BT /F1 8 Tf 0.2 0.2 0.2 rg 300 570 Td (Course Fees) Tj ET`,
    `BT /F1 8 Tf 0.2 0.2 0.2 rg 370 570 Td (${payDate}) Tj ET`,
    `BT /F1 8 Tf 0.2 0.2 0.2 rg 440 570 Td (${amountVal}) Tj ET`,
    `BT /F2 8 Tf 0.1 0.5 0.2 rg 490 570 Td (${amountVal}) Tj ET`,

    // Installment Payments Section
    `BT /F2 10 Tf 0.1 0.1 0.1 rg 50 545 Td (Installment Payments) Tj ET`,
    fillRoundedRect("0.82 0.82 0.82", 50, 525, 495, 18, 4),
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 55 530 Td (Due Date) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 120 530 Td (Invoice) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 170 530 Td (Due Fee) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 230 530 Td (Received Fee) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 300 530 Td (Balance Fee) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 390 530 Td (Payment Details) Tj ET`,

    `BT /F1 8 Tf 0.2 0.2 0.2 rg 55 510 Td (${payDate}) Tj ET`,
    `BT /F1 8 Tf 0.2 0.2 0.2 rg 120 510 Td (566) Tj ET`,
    `BT /F1 8 Tf 0.2 0.2 0.2 rg 170 510 Td (${finalFeeVal}) Tj ET`,
    `BT /F1 8 Tf 0.2 0.2 0.2 rg 230 510 Td (${totalPaidVal}) Tj ET`,
    `BT /F1 8 Tf 0.2 0.2 0.2 rg 300 510 Td (${remainingVal}) Tj ET`,
    `BT /F1 7.5 Tf 0.4 0.4 0.4 rg 390 510 Td (${receiptNo} ${payDate} ${amountVal} ${mode}) Tj ET`,

    // Totals Bar
    fillRoundedRect("0.88 0.88 0.88", 50, 490, 495, 16, 4),
    `BT /F2 8 Tf 0.1 0.1 0.1 rg 170 494 Td (${finalFeeVal}) Tj ET`,
    `BT /F2 8 Tf 0.1 0.5 0.2 rg 230 494 Td (${totalPaidVal}) Tj ET`,
    `BT /F2 8 Tf 0.7 0.1 0.1 rg 300 494 Td (${remainingVal}) Tj ET`,

    // Terms & Conditions Title
    `BT /F2 9.5 Tf 0.1 0.1 0.1 rg 50 465 Td (TERMS & CONDITIONS:) Tj ET`,
    `BT /F1 7.5 Tf 0.2 0.2 0.2 rg 50 450 Td (1. Payment made through cheque is subject to realization. In case cheque is returned / dishonored,) Tj ET`,
    `BT /F1 7.5 Tf 0.2 0.2 0.2 rg 50 440 Td (handling charges of Rs. 500/- along with bank charges will be collected in cash.) Tj ET`,

    `BT /F1 7.5 Tf 0.2 0.2 0.2 rg 50 425 Td (2. Student should strictly adhere to batch / schedule timings specified by centre.) Tj ET`,
    `BT /F1 7.5 Tf 0.2 0.2 0.2 rg 50 415 Td (All breaks must be pre-approved in writing not exceeding 2 months continuously.) Tj ET`,

    `BT /F1 7.5 Tf 0.2 0.2 0.2 rg 50 400 Td (3. Students joining through special scheme / discount cannot avail transfer facility.) Tj ET`,

    `BT /F1 7.5 Tf 0.2 0.2 0.2 rg 50 385 Td (4. Keep receipt safe. Must produce this receipt when collecting completion certificate.) Tj ET`,

    `BT /F1 7.5 Tf 0.2 0.2 0.2 rg 50 370 Td (5. Student is expected to maintain dignity, discipline and decorum of the centre.) Tj ET`,

    `BT /F1 7.5 Tf 0.2 0.2 0.2 rg 50 355 Td (6. Material losses due to mishandling of equipment by student must be paid by student.) Tj ET`,

    `BT /F1 7.5 Tf 0.2 0.2 0.2 rg 50 340 Td (7. Course fee once paid cannot be refunded after commencement of course.) Tj ET`,

    `BT /F1 7.5 Tf 0.2 0.2 0.2 rg 50 325 Td (8. FORCE MAJEURE: Design Gateway/CADD MANTRA accepts no liability for delay or non fulfilment.) Tj ET`,

    `BT /F1 7.5 Tf 0.2 0.2 0.2 rg 50 310 Td (9. Course combinations expected to change based on industry requirements.) Tj ET`,

    // Page Number
    `BT /F1 8 Tf 0.5 0.5 0.5 rg 490 30 Td (Page 1 of 2) Tj ET`,
  ];

  // --- PAGE 2 CONTENT STREAM ---
  const page2Lines = [
    `BT /F1 7.5 Tf 0.2 0.2 0.2 rg 50 780 Td (course by paying additional fee if required for the new combination.) Tj ET`,
    `BT /F1 7.5 Tf 0.2 0.2 0.2 rg 50 765 Td (10. Complete course within 12 months for diploma/short term. 2 years for master diploma.) Tj ET`,
    `BT /F1 7.5 Tf 0.2 0.2 0.2 rg 50 750 Td (11. Fee if paid in installment, all payments must be made per schedule discussed at admission.) Tj ET`,

    // Signature Line
    fillRoundedRect("0.5 0.5 0.5", 380, 620, 150, 1, 4),
    `BT /F2 9 Tf 0.2 0.2 0.2 rg 405 605 Td (Authorised Signatory) Tj ET`,

    // Page Number
    `BT /F1 8 Tf 0.5 0.5 0.5 rg 490 30 Td (Page 2 of 2) Tj ET`,
  ];

  const p1Text = page1Lines.join("\n");
  const p2Text = page2Lines.join("\n");

  const objects = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj`);
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 7 0 R >>\nendobj`);
  objects.push(`4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 8 0 R >>\nendobj`);
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
  objects.push(`6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);
  objects.push(`7 0 obj\n<< /Length ${Buffer.byteLength(p1Text)} >>\nstream\n${p1Text}\nendstream\nendobj`);
  objects.push(`8 0 obj\n<< /Length ${Buffer.byteLength(p2Text)} >>\nstream\n${p2Text}\nendstream\nendobj`);

  let header = "%PDF-1.4\n";
  let body = "";
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  let currentOffset = Buffer.byteLength(header);

  for (let i = 0; i < objects.length; i++) {
    const objStr = objects[i] + "\n";
    const offsetStr = String(currentOffset).padStart(10, "0");
    xref += `${offsetStr} 00000 n \n`;
    body += objStr;
    currentOffset += Buffer.byteLength(objStr);
  }

  const startxref = currentOffset;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

  const fullPdf = header + body + xref + trailer;
  return Buffer.from(fullPdf, "utf-8");
}

/**
 * Generate 4-Page Native PDF Buffer for CoachFlow ERP - Enhanced Daily Business Intelligence Report
 */
export function generateDailyReportPdfBuffer(data: DailyBiReportData): Buffer {
  return buildEnhancedBiReportPdfBuffer(data);
}

export function generateMonthlyReportPdfBuffer(data: DailyBiReportData): Buffer {
  return buildEnhancedBiReportPdfBuffer(data);
}


function drawRoundedRectPath(x: number, y: number, w: number, h: number, r: number = 4): string {
  const k = 0.552 * r;
  const x0 = x, x1 = x + r, x2 = x + w - r, x3 = x + w;
  const y0 = y, y1 = y + r, y2 = y + h - r, y3 = y + h;

  return `${x1} ${y0} m ` +
    `${x2} ${y0} l ` +
    `${x2 + k} ${y0} ${x3} ${y1 - k} ${x3} ${y1} c ` +
    `${x3} ${y2} l ` +
    `${x3} ${y2 + k} ${x2 + k} ${y3} ${x2} ${y3} c ` +
    `${x1} ${y3} l ` +
    `${x1 - k} ${y3} ${x0} ${y2 + k} ${x0} ${y2} c ` +
    `${x0} ${y1} l ` +
    `${x0} ${y1 - k} ${x1 - k} ${y0} ${x1} ${y0} c`;
}

function fillRoundedRect(col: string, x: number, y: number, w: number, h: number, r: number = 4): string {
  return `${col} rg ${drawRoundedRectPath(x, y, w, h, r)} f`;
}

function strokeRoundedRect(col: string, x: number, y: number, w: number, h: number, r: number = 4): string {
  return `${col} RG ${drawRoundedRectPath(x, y, w, h, r)} s`;
}

function buildEnhancedBiReportPdfBuffer(data: DailyBiReportData): Buffer {
  const dateStr = escapePdfText(data.dateStr || new Date().toLocaleDateString("en-IN"));
  const genAtStr = escapePdfText(data.generatedAtStr || "");

  const ex = data.executiveSummary || {
    totalRevenue: { value: 0, changePct: 0 },
    totalCollections: { value: 0, changePct: 0 },
    totalLeads: { value: 0, changePct: 0 },
    admissions: { value: 0, changePct: 0 },
    conversionRate: { value: 0, changePct: 0 },
    outstandingFees: { value: 0, changePct: 0 },
    businessLoss: { value: 0, changePct: 0 },
  };

  const comp = data.revenueComparison || { today: 0, yesterday: 0, sameDayLastWeek: 0 };
  const funnel = data.conversionFunnel || {
    leadsReceived: 0, followupsCompleted: 0, demosScheduled: 0, admissionsConfirmed: 0,
    stagePercentages: { followupPct: 0, demoPct: 0, admissionPct: 0 },
    dropOffRates: { postLeadDropOff: 0, postFollowupDropOff: 0, postDemoDropOff: 0 }
  };
  const loss = data.businessLossAnalysis || {
    totalLeads: 0, totalAdmissions: 0, unconvertedLeads: 0, avgAdmissionValue: 0,
    estimatedBusinessLoss: 0, potentialRevenue: 0, actualRevenue: 0, lostOpportunityPct: 0
  };

  const brands = data.brandPerformance || [];
  const counsellors = data.counsellorPerformance || [];
  const sources = data.leadSourceAnalysis || [];
  const modes = data.collectionSummaryByMode || [];
  const pending = data.pendingFeeSummary || { overdueAmount: 0, overdueStudentsCount: 0, upcomingInstallmentsAmount: 0, studentsRequiringFollowup: [] };
  const targets = data.tomorrowTargets || { revenueTarget: 0, collectionsTarget: 0, admissionsTarget: 0, leadFollowupsTarget: 0, demoSessionsTarget: 0, pendingFeeRecoveryTarget: 0 };
  const ai = data.aiInsights || { executiveSummary: "", keyAchievements: [], recommendedPriorityActions: [] };

  const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");
  const fmtChg = (pct: number) => (pct >= 0 ? `+${pct}%` : `${pct}%`);

  // ─── HELPER: Draw a pie/donut arc slice (approximate with Bezier) ───
  // Uses the approach of multiple bezier segments to approximate a full arc
  function pieSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const steps = Math.ceil(Math.abs(endAngle - startAngle) / 45);
    const step = (endAngle - startAngle) / steps;
    let path = `${cx} ${cy} m `;
    const sx = cx + r * Math.cos(toRad(startAngle));
    const sy = cy + r * Math.sin(toRad(startAngle));
    path += `${sx.toFixed(2)} ${sy.toFixed(2)} l `;
    for (let i = 0; i < steps; i++) {
      const a0 = toRad(startAngle + i * step);
      const a1 = toRad(startAngle + (i + 1) * step);
      const da = a1 - a0;
      const alpha = (4 / 3) * Math.tan(da / 4);
      const x1 = cx + r * (Math.cos(a0) - alpha * Math.sin(a0));
      const y1 = cy + r * (Math.sin(a0) + alpha * Math.cos(a0));
      const x2 = cx + r * (Math.cos(a1) + alpha * Math.sin(a1));
      const y2 = cy + r * (Math.sin(a1) - alpha * Math.cos(a1));
      const x3 = cx + r * Math.cos(a1);
      const y3 = cy + r * Math.sin(a1);
      path += `${x1.toFixed(2)} ${y1.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)} ${x3.toFixed(2)} ${y3.toFixed(2)} c `;
    }
    path += "h f";
    return path;
  }

  function donutSlicePath(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number): string {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const steps = Math.ceil(Math.abs(endAngle - startAngle) / 45);
    const step = (endAngle - startAngle) / steps;
    const sa = toRad(startAngle), ea = toRad(endAngle);
    // Outer arc start
    const oxs = cx + outerR * Math.cos(sa), oys = cy + outerR * Math.sin(sa);
    let path = `${oxs.toFixed(2)} ${oys.toFixed(2)} m `;
    for (let i = 0; i < steps; i++) {
      const a0 = toRad(startAngle + i * step);
      const a1 = toRad(startAngle + (i + 1) * step);
      const da = a1 - a0;
      const alpha = (4 / 3) * Math.tan(da / 4);
      const x1 = cx + outerR * (Math.cos(a0) - alpha * Math.sin(a0));
      const y1 = cy + outerR * (Math.sin(a0) + alpha * Math.cos(a0));
      const x2 = cx + outerR * (Math.cos(a1) + alpha * Math.sin(a1));
      const y2 = cy + outerR * (Math.sin(a1) - alpha * Math.cos(a1));
      const x3 = cx + outerR * Math.cos(a1);
      const y3 = cy + outerR * Math.sin(a1);
      path += `${x1.toFixed(2)} ${y1.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)} ${x3.toFixed(2)} ${y3.toFixed(2)} c `;
    }
    // Line to inner arc end
    const ixe = cx + innerR * Math.cos(ea), iye = cy + innerR * Math.sin(ea);
    path += `${ixe.toFixed(2)} ${iye.toFixed(2)} l `;
    // Inner arc reverse
    for (let i = steps - 1; i >= 0; i--) {
      const a0 = toRad(startAngle + (i + 1) * step);
      const a1 = toRad(startAngle + i * step);
      const da = a1 - a0;
      const alpha = (4 / 3) * Math.tan(da / 4);
      const x1 = cx + innerR * (Math.cos(a0) - alpha * Math.sin(a0));
      const y1 = cy + innerR * (Math.sin(a0) + alpha * Math.cos(a0));
      const x2 = cx + innerR * (Math.cos(a1) + alpha * Math.sin(a1));
      const y2 = cy + innerR * (Math.sin(a1) - alpha * Math.cos(a1));
      const x3 = cx + innerR * Math.cos(a1);
      const y3 = cy + innerR * Math.sin(a1);
      path += `${x1.toFixed(2)} ${y1.toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)} ${x3.toFixed(2)} ${y3.toFixed(2)} c `;
    }
    path += "h f";
    return path;
  }

  // Palette: indigo, emerald, amber, rose, cyan, violet
  const PALETTE = [
    { rg: "0.29 0.0 0.51",  label: "Indigo"   },
    { rg: "0.02 0.59 0.41", label: "Emerald"  },
    { rg: "0.85 0.45 0.05", label: "Amber"    },
    { rg: "0.88 0.17 0.24", label: "Rose"     },
    { rg: "0.02 0.52 0.78", label: "Cyan"     },
    { rg: "0.48 0.22 0.93", label: "Violet"   },
  ];

  // ══════════════════════════════════════════════════════════
  // PAGE 1  –  Header · KPI Cards · Bar Chart · Donut Chart
  // ══════════════════════════════════════════════════════════
  const page1Lines: string[] = [];

  // ── Header gradient-look (two-layer) ──
  page1Lines.push(fillRoundedRect("0.08 0.12 0.28", 20, 768, 555, 60, 8));
  page1Lines.push(fillRoundedRect("0.12 0.18 0.38", 20, 768, 555, 30, 0));
  page1Lines.push(`BT /F2 14 Tf 1 1 1 rg 38 806 Td (COACHFLOW ERP  \xb7  EXECUTIVE BI MASTER REPORT) Tj ET`);
  page1Lines.push(`BT /F1 8 Tf 0.75 0.85 0.95 rg 38 789 Td (Date: ${dateStr}    Generated: ${genAtStr}    |    CoachFlow v3.2) Tj ET`);

  // ── Accent line under header ──
  page1Lines.push(fillRoundedRect("0.29 0.0 0.51", 20, 765, 555, 3, 0));

  // ── Section Title: KPIs ──
  page1Lines.push(`BT /F2 9 Tf 0.29 0.0 0.51 rg 22 748 Td (KEY PERFORMANCE INDICATORS) Tj ET`);

  // ── KPI Card helper ──
  const kpiCard = (x: number, y: number, w: number, h: number, accentCol: string, label: string, value: string, badge: string, badgeCol: string) => {
    const lines: string[] = [];
    lines.push(fillRoundedRect("0.97 0.97 0.99", x, y, w, h, 6));
    lines.push(fillRoundedRect(accentCol, x, y + h - 4, w, 4, 4));
    lines.push(`BT /F2 6.5 Tf 0.45 0.45 0.55 rg ${x + 8} ${y + h - 15} Td (${label}) Tj ET`);
    lines.push(`BT /F2 11 Tf 0.08 0.10 0.22 rg ${x + 8} ${y + h - 30} Td (${value}) Tj ET`);
    lines.push(fillRoundedRect(badgeCol, x + 8, y + 8, 65, 12, 4));
    lines.push(`BT /F2 6 Tf 1 1 1 rg ${x + 11} ${y + 12} Td (${badge}) Tj ET`);
    return lines;
  };

  // Row 1 KPIs
  page1Lines.push(...kpiCard(22,  680, 126, 60, "0.02 0.59 0.41", "TOTAL REVENUE",     `Rs.${fmt(ex.totalRevenue?.value||0)}`,      fmtChg(ex.totalRevenue?.changePct||0)+" vs yest", "0.02 0.59 0.41"));
  page1Lines.push(...kpiCard(155, 680, 126, 60, "0.14 0.38 0.92", "TOTAL COLLECTIONS", `Rs.${fmt(ex.totalCollections?.value||0)}`,  fmtChg(ex.totalCollections?.changePct||0)+" vs yest", "0.14 0.38 0.92"));
  page1Lines.push(...kpiCard(288, 680, 126, 60, "0.48 0.22 0.93", "TOTAL LEADS",       `${ex.totalLeads?.value||0} Enquiries`,       fmtChg(ex.totalLeads?.changePct||0)+" vs yest", "0.48 0.22 0.93"));
  page1Lines.push(...kpiCard(421, 680, 154, 60, "0.02 0.52 0.78", "ADMISSIONS",        `${ex.admissions?.value||0} Confirmed`,       fmtChg(ex.admissions?.changePct||0)+" vs yest", "0.02 0.52 0.78"));

  // Row 2 KPIs
  page1Lines.push(...kpiCard(22,  612, 126, 60, "0.85 0.45 0.05", "CONVERSION RATE",   `${ex.conversionRate?.value||0}%`,             "Target > 15%", "0.85 0.45 0.05"));
  page1Lines.push(...kpiCard(155, 612, 126, 60, "0.35 0.40 0.50", "OUTSTANDING FEES",  `Rs.${fmt(ex.outstandingFees?.value||0)}`,   "Pending Recovery", "0.35 0.40 0.50"));
  page1Lines.push(...kpiCard(288, 612, 126, 60, "0.88 0.17 0.24", "ESTIMATED LOSS",    `Rs.${fmt(ex.businessLoss?.value||0)}`,      "Unconverted Opp.", "0.88 0.17 0.24"));
  page1Lines.push(...kpiCard(421, 612, 154, 60, "0.7 0.15 0.55",  "UNCONVERTED",       `${loss.unconvertedLeads||0} Leads`,          "Priority Followup", "0.7 0.15 0.55"));

  // ── SECTION: Vertical Bar Chart – Brand Revenue ──
  page1Lines.push(`BT /F2 9 Tf 0.29 0.0 0.51 rg 22 603 Td (BRAND REVENUE BAR CHART  \xb7  Daily Collections Comparison) Tj ET`);

  const barChartX = 22, barChartY = 490, barChartH = 108, barChartW = 350;
  const topBrands = brands.slice(0, 6);
  const maxBrandColl = Math.max(...topBrands.map(b => b.dailyCollections || 0), 1);
  const barSlotW = topBrands.length > 0 ? Math.floor(barChartW / topBrands.length) : 60;
  const barW = Math.min(40, barSlotW - 8);

  // Chart background
  page1Lines.push(fillRoundedRect("0.97 0.97 0.99", barChartX, barChartY, barChartW, barChartH, 6));
  // Grid lines (3 horizontal)
  [25, 50, 75].forEach(pct => {
    const gy = barChartY + (pct / 100) * barChartH;
    page1Lines.push(`0.90 0.90 0.93 RG ${barChartX + 5} ${gy.toFixed(1)} m ${barChartX + barChartW - 5} ${gy.toFixed(1)} l s`);
  });

  topBrands.forEach((b, idx) => {
    const col = PALETTE[idx % PALETTE.length].rg;
    const barH = Math.max(4, ((b.dailyCollections || 0) / maxBrandColl) * (barChartH - 20));
    const bx = barChartX + idx * barSlotW + Math.floor((barSlotW - barW) / 2);
    const by = barChartY + 2;
    // Bar shadow
    page1Lines.push(fillRoundedRect("0.88 0.88 0.92", bx + 2, by + 2, barW, barH, 3));
    // Bar fill
    page1Lines.push(fillRoundedRect(col, bx, by, barW, barH, 3));
    // Value label above bar
    const vLabel = b.dailyCollections >= 100000 ? `${(b.dailyCollections/100000).toFixed(1)}L` : `${Math.round((b.dailyCollections||0)/1000)}K`;
    page1Lines.push(`BT /F2 6.5 Tf 0.08 0.10 0.22 rg ${bx} ${by + barH + 3} Td (${vLabel}) Tj ET`);
    // Brand label below
    const shortName = escapePdfText((b.brandName || "").slice(0, 10));
    page1Lines.push(`BT /F1 5.5 Tf 0.35 0.35 0.45 rg ${bx - 2} ${barChartY - 10} Td (${shortName}) Tj ET`);
  });

  // ── SECTION: Donut Chart – Payment Mode Distribution (right of bar chart) ──
  page1Lines.push(`BT /F2 9 Tf 0.29 0.0 0.51 rg 388 603 Td (PAYMENT MODE  \xb7  Donut Chart) Tj ET`);

  const dCX = 494, dCY = 545, dOuter = 52, dInner = 28;
  const totalModeAmt = modes.reduce((s, m) => s + (m.amount || 0), 0) || 1;
  let dAngle = -90;
  modes.slice(0, 5).forEach((m, idx) => {
    const col = PALETTE[idx % PALETTE.length].rg;
    const sweep = ((m.amount || 0) / totalModeAmt) * 360;
    if (sweep < 1) { dAngle += sweep; return; }
    page1Lines.push(`${col} rg ${donutSlicePath(dCX, dCY, dOuter, dInner, dAngle, dAngle + sweep)}`);
    dAngle += sweep;
  });
  // White center hole label
  page1Lines.push(fillRoundedRect("1 1 1", dCX - dInner, dCY - dInner, dInner * 2, dInner * 2, dInner));
  page1Lines.push(`BT /F2 6.5 Tf 0.29 0.0 0.51 rg ${dCX - 14} ${dCY + 4} Td (PAYMENT) Tj ET`);
  page1Lines.push(`BT /F2 6.5 Tf 0.29 0.0 0.51 rg ${dCX - 11} ${dCY - 6} Td (MODES) Tj ET`);
  // Legend
  let legY = 590;
  modes.slice(0, 4).forEach((m, idx) => {
    const col = PALETTE[idx % PALETTE.length].rg;
    page1Lines.push(fillRoundedRect(col, 386, legY - 6, 8, 8, 2));
    page1Lines.push(`BT /F1 6.5 Tf 0.2 0.2 0.2 rg 397 ${legY - 1} Td (${escapePdfText(m.mode)}: ${m.percentage}%) Tj ET`);
    legY -= 13;
  });

  // ── SECTION: Revenue Comparison Bar Chart ──
  page1Lines.push(`BT /F2 9 Tf 0.29 0.0 0.51 rg 22 480 Td (REVENUE BENCHMARK  \xb7  Today vs Yesterday vs Last Week) Tj ET`);
  const rbY = 400, rbH = 72;
  page1Lines.push(fillRoundedRect("0.97 0.97 0.99", 22, rbY, 555, rbH, 6));

  const maxComp = Math.max(comp.today || 0, comp.yesterday || 0, comp.sameDayLastWeek || 0, 1);
  const barsData = [
    { label: "Today", value: comp.today || 0, col: "0.02 0.59 0.41" },
    { label: "Yesterday", value: comp.yesterday || 0, col: "0.29 0.0 0.51" },
    { label: "Last Week", value: comp.sameDayLastWeek || 0, col: "0.48 0.22 0.93" },
  ];
  const rbBarSlotW = 185, rbBarW = 28;
  barsData.forEach((bd, idx) => {
    const bx = 22 + idx * rbBarSlotW + 10;
    const bh = Math.max(4, (bd.value / maxComp) * (rbH - 22));
    const by = rbY + 2;
    // Shadow bar
    page1Lines.push(fillRoundedRect("0.88 0.88 0.92", bx + 2 + 2, by + 2, rbBarW, bh, 3));
    // Actual bar
    page1Lines.push(fillRoundedRect(bd.col, bx + 2, by, rbBarW, bh, 3));
    const amt = bd.value >= 100000 ? `Rs.${(bd.value/100000).toFixed(1)}L` : `Rs.${Math.round(bd.value/1000)}K`;
    page1Lines.push(`BT /F2 7 Tf 0.08 0.10 0.22 rg ${bx + 2} ${by + bh + 4} Td (${amt}) Tj ET`);
    page1Lines.push(`BT /F1 6.5 Tf 0.45 0.45 0.55 rg ${bx + 2} ${rbY - 8} Td (${bd.label}) Tj ET`);
  });

  // ── SECTION: Lead Funnel ──
  page1Lines.push(`BT /F2 9 Tf 0.29 0.0 0.51 rg 22 392 Td (CONVERSION FUNNEL  \xb7  Lead Pipeline Stage Drop-Off) Tj ET`);
  const funnelData = [
    { label: `1. Leads Received: ${funnel.leadsReceived}`, pct: 100, col: "0.29 0.0 0.51" },
    { label: `2. Followups: ${funnel.followupsCompleted} (${funnel.stagePercentages?.followupPct||0}%)`, pct: funnel.stagePercentages?.followupPct||0, col: "0.14 0.38 0.92" },
    { label: `3. Demos: ${funnel.demosScheduled} (${funnel.stagePercentages?.demoPct||0}%)`, pct: funnel.stagePercentages?.demoPct||0, col: "0.48 0.22 0.93" },
    { label: `4. Admissions: ${funnel.admissionsConfirmed} (${funnel.stagePercentages?.admissionPct||0}%)`, pct: funnel.stagePercentages?.admissionPct||0, col: "0.02 0.59 0.41" },
  ];
  let fY = 374;
  funnelData.forEach(f => {
    const fw = Math.max(10, (f.pct / 100) * 510);
    page1Lines.push(fillRoundedRect("0.93 0.93 0.96", 22, fY - 11, 555, 14, 3));
    page1Lines.push(fillRoundedRect(f.col, 22, fY - 11, fw, 14, 3));
    page1Lines.push(`BT /F2 7 Tf 1 1 1 rg 28 ${fY - 5} Td (${escapePdfText(f.label)}) Tj ET`);
    fY -= 18;
  });

  // Footer
  page1Lines.push(fillRoundedRect("0.85 0.85 0.85", 20, 45, 555, 1, 0));
  page1Lines.push(`BT /F1 7.5 Tf 0.5 0.5 0.5 rg 22 30 Td (CoachFlow ERP  \xb7  Executive BI Report  \xb7  Page 1 of 2) Tj ET`);
  page1Lines.push(`BT /F1 7.5 Tf 0.5 0.5 0.5 rg 490 30 Td (Generated: ${genAtStr}) Tj ET`);

  // ══════════════════════════════════════════════════════════
  // PAGE 2  –  Counsellors · Pie Chart · EMI List · AI Synthesis
  // ══════════════════════════════════════════════════════════
  const page2Lines: string[] = [];

  // Header
  page2Lines.push(fillRoundedRect("0.08 0.12 0.28", 20, 768, 555, 60, 8));
  page2Lines.push(fillRoundedRect("0.12 0.18 0.38", 20, 768, 555, 30, 0));
  page2Lines.push(`BT /F2 14 Tf 1 1 1 rg 38 806 Td (COACHFLOW ERP  \xb7  SALES & FINANCIAL INTELLIGENCE) Tj ET`);
  page2Lines.push(`BT /F1 8 Tf 0.75 0.85 0.95 rg 38 789 Td (Date: ${dateStr}    Page 2 of 2    |    CoachFlow Decision Support Engine v3.2) Tj ET`);
  page2Lines.push(fillRoundedRect("0.02 0.59 0.41", 20, 765, 555, 3, 0));

  // ── Counsellor Performance Table ──
  page2Lines.push(`BT /F2 9 Tf 0.29 0.0 0.51 rg 22 748 Td (COUNSELLOR PERFORMANCE SCORECARD) Tj ET`);
  page2Lines.push(fillRoundedRect("0.12 0.18 0.38", 22, 728, 555, 16, 4));
  page2Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 28 733 Td (Name) Tj ET`);
  page2Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 155 733 Td (Scope) Tj ET`);
  page2Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 215 733 Td (Leads) Tj ET`);
  page2Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 255 733 Td (Adm) Tj ET`);
  page2Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 295 733 Td (Conv%) Tj ET`);
  page2Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 340 733 Td (Collections) Tj ET`);
  page2Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 450 733 Td (Status) Tj ET`);

  let p2Y = 715;
  counsellors.slice(0, 5).forEach((cs, idx) => {
    const bg = idx % 2 === 0 ? "0.96 0.97 0.99" : "1 1 1";
    page2Lines.push(fillRoundedRect(bg, 22, p2Y - 2, 555, 14, 2));
    page2Lines.push(`BT /F1 7 Tf 0.12 0.12 0.22 rg 28 ${p2Y + 2} Td (${escapePdfText(cs.name)}) Tj ET`);
    page2Lines.push(`BT /F1 7 Tf 0.12 0.12 0.22 rg 155 ${p2Y + 2} Td (${escapePdfText(cs.brandScope)}) Tj ET`);
    page2Lines.push(`BT /F1 7 Tf 0.12 0.12 0.22 rg 215 ${p2Y + 2} Td (${cs.leadsAssigned}) Tj ET`);
    page2Lines.push(`BT /F1 7 Tf 0.12 0.12 0.22 rg 255 ${p2Y + 2} Td (${cs.admissionsConverted}) Tj ET`);
    page2Lines.push(`BT /F1 7 Tf 0.12 0.12 0.22 rg 295 ${p2Y + 2} Td (${cs.conversionPct}%) Tj ET`);
    page2Lines.push(`BT /F2 7 Tf 0.02 0.59 0.41 rg 340 ${p2Y + 2} Td (Rs.${fmt(cs.collectionsGenerated||0)}) Tj ET`);
    const tagCol = cs.isTopPerformer ? "0.02 0.59 0.41" : cs.isLowPerformer ? "0.88 0.17 0.24" : "0.14 0.38 0.92";
    const tag = cs.isTopPerformer ? "Top Performer" : cs.isLowPerformer ? "Low Velocity" : "Active";
    page2Lines.push(fillRoundedRect(tagCol, 450, p2Y - 1, 65, 12, 3));
    page2Lines.push(`BT /F2 6 Tf 1 1 1 rg 454 ${p2Y + 3} Td (${tag}) Tj ET`);
    p2Y -= 14;
  });

  // ── Pie Chart: Lead Source Distribution + Bar chart side by side ──
  p2Y -= 10;
  page2Lines.push(`BT /F2 9 Tf 0.29 0.0 0.51 rg 22 ${p2Y} Td (LEAD SOURCE PIE CHART  \xb7  Marketing ROI Distribution) Tj ET`);
  p2Y -= 16;

  const pieCX = 100, pieCY = p2Y - 58, pieR = 52;
  const totalSrcLeads = sources.reduce((s, src) => s + (src.leadsGenerated || 0), 0) || 1;
  let pAngle = -90;
  sources.slice(0, 5).forEach((src, idx) => {
    const col = PALETTE[idx % PALETTE.length].rg;
    const sweep = ((src.leadsGenerated || 0) / totalSrcLeads) * 360;
    if (sweep < 1) { pAngle += sweep; return; }
    page2Lines.push(`${col} rg ${pieSlicePath(pieCX, pieCY, pieR, pAngle, pAngle + sweep)}`);
    pAngle += sweep;
  });

  // Pie Legend
  let pieLegY = p2Y - 10;
  sources.slice(0, 5).forEach((src, idx) => {
    const col = PALETTE[idx % PALETTE.length].rg;
    page2Lines.push(fillRoundedRect(col, 168, pieLegY - 7, 9, 9, 2));
    page2Lines.push(`BT /F1 7 Tf 0.1 0.1 0.2 rg 180 ${pieLegY - 2} Td (${escapePdfText(src.source)}: ${src.leadsGenerated} leads) Tj ET`);
    pieLegY -= 14;
  });

  // Lead Source Bar Chart on the right side
  page2Lines.push(`BT /F2 9 Tf 0.29 0.0 0.51 rg 380 ${p2Y} Td (MARKETING ROI  \xb7  Revenue per Source) Tj ET`);
  const srcMaxRev = Math.max(...sources.map(s => s.revenueContribution || 0), 1);
  let srcBY = p2Y - 16;
  sources.slice(0, 5).forEach((src, idx) => {
    const col = PALETTE[idx % PALETTE.length].rg;
    const bw = Math.max(5, ((src.revenueContribution || 0) / srcMaxRev) * 150);
    page2Lines.push(fillRoundedRect("0.93 0.93 0.96", 380, srcBY - 10, 195, 12, 3));
    page2Lines.push(fillRoundedRect(col, 380, srcBY - 10, bw, 12, 3));
    page2Lines.push(`BT /F1 6.5 Tf 0.1 0.1 0.2 rg 384 ${srcBY - 5} Td (${escapePdfText(src.source)}: Rs.${fmt(src.revenueContribution||0)}) Tj ET`);
    srcBY -= 16;
  });

  p2Y = pieCY - pieR - 20;

  // ── EMI Priority List ──
  page2Lines.push(`BT /F2 9 Tf 0.29 0.0 0.51 rg 22 ${p2Y} Td (OVERDUE EMI  \xb7  Priority Follow-Up List) Tj ET`);
  p2Y -= 16;
  page2Lines.push(fillRoundedRect("0.7 0.2 0.2", 22, p2Y, 555, 14, 4));
  page2Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 28 ${p2Y + 4} Td (Student Name) Tj ET`);
  page2Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 175 ${p2Y + 4} Td (Course) Tj ET`);
  page2Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 305 ${p2Y + 4} Td (Phone) Tj ET`);
  page2Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 400 ${p2Y + 4} Td (Balance Due) Tj ET`);
  page2Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 490 ${p2Y + 4} Td (Due Date) Tj ET`);
  p2Y -= 14;
  (pending.studentsRequiringFollowup || []).slice(0, 4).forEach((st, idx) => {
    const bg = idx % 2 === 0 ? "0.99 0.96 0.96" : "1 1 1";
    page2Lines.push(fillRoundedRect(bg, 22, p2Y - 2, 555, 14, 2));
    page2Lines.push(`BT /F1 7 Tf 0.12 0.12 0.22 rg 28 ${p2Y + 2} Td (${escapePdfText(st.fullName)}) Tj ET`);
    page2Lines.push(`BT /F1 7 Tf 0.12 0.12 0.22 rg 175 ${p2Y + 2} Td (${escapePdfText(st.course)}) Tj ET`);
    page2Lines.push(`BT /F1 7 Tf 0.12 0.12 0.22 rg 305 ${p2Y + 2} Td (${escapePdfText(st.mobileNumber)}) Tj ET`);
    page2Lines.push(`BT /F2 7 Tf 0.7 0.1 0.1 rg 400 ${p2Y + 2} Td (Rs.${fmt(st.remainingBalance||0)}) Tj ET`);
    page2Lines.push(`BT /F1 7 Tf 0.3 0.3 0.4 rg 490 ${p2Y + 2} Td (${escapePdfText(st.nextDueDate)}) Tj ET`);
    p2Y -= 14;
  });

  // ── Predictive Targets mini-bars ──
  p2Y -= 8;
  page2Lines.push(`BT /F2 9 Tf 0.29 0.0 0.51 rg 22 ${p2Y} Td (TOMORROW'S TARGETS  \xb7  Predictive Business Goals) Tj ET`);
  p2Y -= 14;
  page2Lines.push(fillRoundedRect("0.97 0.97 0.99", 22, p2Y - 42, 555, 46, 6));
  const targetsData = [
    { label: "Revenue", val: targets.revenueTarget||0, col: "0.02 0.59 0.41" },
    { label: "Collections", val: targets.collectionsTarget||0, col: "0.14 0.38 0.92" },
    { label: "Admissions", val: (targets.admissionsTarget||0)*10000, col: "0.48 0.22 0.93" },
  ];
  const maxTarget = Math.max(...targetsData.map(t => t.val), 1);
  targetsData.forEach((t, idx) => {
    const tx = 30 + idx * 185;
    const tw = Math.max(5, (t.val / maxTarget) * 160);
    page2Lines.push(`BT /F2 6.5 Tf 0.29 0.0 0.51 rg ${tx} ${p2Y - 8} Td (${t.label}) Tj ET`);
    page2Lines.push(fillRoundedRect("0.88 0.88 0.92", tx, p2Y - 26, 165, 10, 3));
    page2Lines.push(fillRoundedRect(t.col, tx, p2Y - 26, tw, 10, 3));
    const tVal = t.label === "Admissions" ? `${targets.admissionsTarget||0} Students` : `Rs.${fmt(t.val)}`;
    page2Lines.push(`BT /F1 6.5 Tf 0.1 0.1 0.2 rg ${tx} ${p2Y - 38} Td (${tVal}) Tj ET`);
  });
  p2Y -= 56;

  // ── AI Synthesis Dark Card ──
  page2Lines.push(`BT /F2 9 Tf 0.29 0.0 0.51 rg 22 ${p2Y} Td (AI SYNTHESIS  \xb7  Strategic Executive Insights) Tj ET`);
  p2Y -= 14;
  const aiCardH = 170;
  page2Lines.push(fillRoundedRect("0.06 0.09 0.16", 22, p2Y - aiCardH, 555, aiCardH, 8));
  page2Lines.push(fillRoundedRect("0.29 0.0 0.51", 22, p2Y - 4, 555, 4, 4));

  page2Lines.push(`BT /F2 9 Tf 0.34 0.8 0.95 rg 32 ${p2Y - 18} Td (AUTOMATED EXECUTIVE OBSERVATION SUMMARY) Tj ET`);
  page2Lines.push(`BT /F1 7.5 Tf 0.85 0.85 0.9 rg 32 ${p2Y - 32} Td (${escapePdfText(ai.executiveSummary||"Monitoring active across all CRM, admissions & financial streams.")}) Tj ET`);

  page2Lines.push(`BT /F2 8 Tf 0.4 0.9 0.5 rg 32 ${p2Y - 52} Td (KEY ACHIEVEMENTS TODAY) Tj ET`);
  let aY = p2Y - 65;
  (ai.keyAchievements || []).slice(0, 3).forEach(ach => {
    page2Lines.push(fillRoundedRect("0.02 0.59 0.41", 32, aY - 4, 6, 6, 2));
    page2Lines.push(`BT /F1 7 Tf 0.92 0.95 0.98 rg 42 ${aY} Td (${escapePdfText(ach)}) Tj ET`);
    aY -= 13;
  });

  aY -= 4;
  page2Lines.push(`BT /F2 8 Tf 1 0.7 0.3 rg 32 ${aY} Td (RECOMMENDED ACTIONS FOR TOMORROW) Tj ET`);
  aY -= 13;
  (ai.recommendedPriorityActions || []).slice(0, 3).forEach(act => {
    page2Lines.push(fillRoundedRect("0.85 0.45 0.05", 32, aY - 4, 6, 6, 2));
    page2Lines.push(`BT /F1 7 Tf 0.92 0.95 0.98 rg 42 ${aY} Td (${escapePdfText(act)}) Tj ET`);
    aY -= 13;
  });

  // Footer
  page2Lines.push(fillRoundedRect("0.85 0.85 0.85", 20, 45, 555, 1, 0));
  page2Lines.push(`BT /F1 7.5 Tf 0.5 0.5 0.5 rg 22 30 Td (CoachFlow ERP  \xb7  Executive BI Report  \xb7  Page 2 of 2) Tj ET`);
  page2Lines.push(`BT /F1 7.5 Tf 0.5 0.5 0.5 rg 490 30 Td (Official Report) Tj ET`);

  // ── Assemble PDF ──
  const p1Text = page1Lines.join("\n");
  const p2Text = page2Lines.join("\n");

  const objects = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj`);
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 7 0 R >>\nendobj`);
  objects.push(`4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 8 0 R >>\nendobj`);
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
  objects.push(`6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);
  objects.push(`7 0 obj\n<< /Length ${Buffer.byteLength(p1Text)} >>\nstream\n${p1Text}\nendstream\nendobj`);
  objects.push(`8 0 obj\n<< /Length ${Buffer.byteLength(p2Text)} >>\nstream\n${p2Text}\nendstream\nendobj`);

  let header = "%PDF-1.4\n";
  let body = "";
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  let currentOffset = Buffer.byteLength(header);

  for (let i = 0; i < objects.length; i++) {
    const objStr = objects[i] + "\n";
    xref += `${String(currentOffset).padStart(10, "0")} 00000 n \n`;
    body += objStr;
    currentOffset += Buffer.byteLength(objStr);
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${currentOffset}\n%%EOF\n`;
  return Buffer.from(header + body + xref + trailer, "utf-8");
}
