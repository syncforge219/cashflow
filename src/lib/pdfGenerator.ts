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

  const trend = data.revenueTrend || [];
  const comp = data.revenueComparison || { today: 0, yesterday: 0, sameDayLastWeek: 0 };
  const funnel = data.conversionFunnel || {
    leadsReceived: 0,
    followupsCompleted: 0,
    demosScheduled: 0,
    admissionsConfirmed: 0,
    stagePercentages: { followupPct: 0, demoPct: 0, admissionPct: 0 },
    dropOffRates: { postLeadDropOff: 0, postFollowupDropOff: 0, postDemoDropOff: 0 }
  };
  const loss = data.businessLossAnalysis || {
    totalLeads: 0,
    totalAdmissions: 0,
    unconvertedLeads: 0,
    avgAdmissionValue: 0,
    estimatedBusinessLoss: 0,
    potentialRevenue: 0,
    actualRevenue: 0,
    lostOpportunityPct: 0
  };

  const brands = data.brandPerformance || [];
  const counsellors = data.counsellorPerformance || [];
  const sources = data.leadSourceAnalysis || [];
  const modes = data.collectionSummaryByMode || [];
  const pending = data.pendingFeeSummary || { overdueAmount: 0, overdueStudentsCount: 0, upcomingInstallmentsAmount: 0, studentsRequiringFollowup: [] };
  const alerts = data.operationalAlerts || [];
  const targets = data.tomorrowTargets || { revenueTarget: 0, collectionsTarget: 0, admissionsTarget: 0, leadFollowupsTarget: 0, demoSessionsTarget: 0, pendingFeeRecoveryTarget: 0 };
  const ai = data.aiInsights || { executiveSummary: "", keyAchievements: [], recommendedPriorityActions: [] };

  const formatChange = (pct: number) => (pct >= 0 ? `+${pct}%` : `${pct}%`);

  // ==========================================
  // PAGE 1: HEADER + PREMIUM KPI CARDS + BRAND REVENUE BARS + BENCHMARKS + FUNNEL
  // ==========================================
  const page1Lines: string[] = [
    // Header Banner Box (Slate Navy)
    fillRoundedRect("0.08 0.12 0.25", 30, 772, 535, 52, 4),
    `BT /F2 13.5 Tf 1 1 1 rg 45 802 Td (COACHFLOW ERP - EXECUTIVE BUSINESS INTELLIGENCE REPORT) Tj ET`,
    `BT /F1 8 Tf 0.85 0.9 0.98 rg 45 786 Td (Report Date: ${dateStr}    |    Generated at: ${genAtStr}) Tj ET`,

    // Section 1: Executive KPI Grid (8 Premium Cards)
    `BT /F2 9.5 Tf 0.08 0.12 0.25 rg 40 754 Td (1. EXECUTIVE KEY PERFORMANCE INDICATORS) Tj ET`,
  ];

  // Helper for Card Construction
  // Row 1 (Y = 688..742)
  // Card 1: Total Revenue
  page1Lines.push(fillRoundedRect("0.96 0.97 0.99", 40, 688, 120, 54, 4));
  page1Lines.push(strokeRoundedRect("0.85 0.88 0.92", 40, 688, 120, 54, 4));
  page1Lines.push(fillRoundedRect("0.02 0.59 0.41", 40, 739, 120, 3, 4));
  page1Lines.push(`BT /F2 7 Tf 0.4 0.45 0.55 rg 48 726 Td (TOTAL REVENUE) Tj ET`);
  page1Lines.push(`BT /F2 10 Tf 0.08 0.12 0.25 rg 48 710 Td (Rs. ${Math.round(ex.totalRevenue?.value || 0).toLocaleString("en-IN")}) Tj ET`);
  page1Lines.push(fillRoundedRect("0.02 0.59 0.41", 48, 695, 62, 11, 4));
  page1Lines.push(`BT /F2 6.5 Tf 1 1 1 rg 52 698 Td (${formatChange(ex.totalRevenue?.changePct || 0)} vs yest) Tj ET`);

  // Card 2: Total Collections
  page1Lines.push(fillRoundedRect("0.96 0.97 0.99", 171, 688, 120, 54, 4));
  page1Lines.push(strokeRoundedRect("0.85 0.88 0.92", 171, 688, 120, 54, 4));
  page1Lines.push(fillRoundedRect("0.14 0.38 0.92", 171, 739, 120, 3, 4));
  page1Lines.push(`BT /F2 7 Tf 0.4 0.45 0.55 rg 179 726 Td (TOTAL COLLECTIONS) Tj ET`);
  page1Lines.push(`BT /F2 10 Tf 0.08 0.12 0.25 rg 179 710 Td (Rs. ${Math.round(ex.totalCollections?.value || 0).toLocaleString("en-IN")}) Tj ET`);
  page1Lines.push(fillRoundedRect("0.14 0.38 0.92", 179, 695, 62, 11, 4));
  page1Lines.push(`BT /F2 6.5 Tf 1 1 1 rg 183 698 Td (${formatChange(ex.totalCollections?.changePct || 0)} vs yest) Tj ET`);

  // Card 3: Total Leads
  page1Lines.push(fillRoundedRect("0.96 0.97 0.99", 302, 688, 120, 54, 4));
  page1Lines.push(strokeRoundedRect("0.85 0.88 0.92", 302, 688, 120, 54, 4));
  page1Lines.push(fillRoundedRect("0.48 0.22 0.93", 302, 739, 120, 3, 4));
  page1Lines.push(`BT /F2 7 Tf 0.4 0.45 0.55 rg 310 726 Td (TOTAL LEADS) Tj ET`);
  page1Lines.push(`BT /F2 10 Tf 0.08 0.12 0.25 rg 310 710 Td (${ex.totalLeads?.value || 0} Enquiries) Tj ET`);
  page1Lines.push(fillRoundedRect("0.48 0.22 0.93", 310, 695, 62, 11, 4));
  page1Lines.push(`BT /F2 6.5 Tf 1 1 1 rg 314 698 Td (${formatChange(ex.totalLeads?.changePct || 0)} vs yest) Tj ET`);

  // Card 4: Admissions
  page1Lines.push(fillRoundedRect("0.96 0.97 0.99", 433, 688, 122, 54, 4));
  page1Lines.push(strokeRoundedRect("0.85 0.88 0.92", 433, 688, 122, 54, 4));
  page1Lines.push(fillRoundedRect("0.02 0.52 0.78", 433, 739, 122, 3, 4));
  page1Lines.push(`BT /F2 7 Tf 0.4 0.45 0.55 rg 441 726 Td (ADMISSIONS) Tj ET`);
  page1Lines.push(`BT /F2 10 Tf 0.08 0.12 0.25 rg 441 710 Td (${ex.admissions?.value || 0} Confirmed) Tj ET`);
  page1Lines.push(fillRoundedRect("0.02 0.52 0.78", 441, 695, 62, 11, 4));
  page1Lines.push(`BT /F2 6.5 Tf 1 1 1 rg 445 698 Td (${formatChange(ex.admissions?.changePct || 0)} vs yest) Tj ET`);

  // Row 2 (Y = 626..680)
  // Card 5: Conversion Rate
  page1Lines.push(fillRoundedRect("0.96 0.97 0.99", 40, 626, 120, 54, 4));
  page1Lines.push(strokeRoundedRect("0.85 0.88 0.92", 40, 626, 120, 54, 4));
  page1Lines.push(fillRoundedRect("0.85 0.45 0.05", 40, 677, 120, 3, 4));
  page1Lines.push(`BT /F2 7 Tf 0.4 0.45 0.55 rg 48 664 Td (CONVERSION RATE) Tj ET`);
  page1Lines.push(`BT /F2 10 Tf 0.08 0.12 0.25 rg 48 648 Td (${ex.conversionRate?.value || 0}%) Tj ET`);
  page1Lines.push(`BT /F1 7 Tf 0.5 0.3 0.1 rg 48 634 Td (Target: >15%) Tj ET`);

  // Card 6: Outstanding Fees
  page1Lines.push(fillRoundedRect("0.96 0.97 0.99", 171, 626, 120, 54, 4));
  page1Lines.push(strokeRoundedRect("0.85 0.88 0.92", 171, 626, 120, 54, 4));
  page1Lines.push(fillRoundedRect("0.3 0.35 0.45", 171, 677, 120, 3, 4));
  page1Lines.push(`BT /F2 7 Tf 0.4 0.45 0.55 rg 179 664 Td (OUTSTANDING FEES) Tj ET`);
  page1Lines.push(`BT /F2 10 Tf 0.08 0.12 0.25 rg 179 648 Td (Rs. ${Math.round(ex.outstandingFees?.value || 0).toLocaleString("en-IN")}) Tj ET`);
  page1Lines.push(`BT /F1 7 Tf 0.4 0.4 0.5 rg 179 634 Td (Pending Recovery) Tj ET`);

  // Card 7: Estimated Loss
  page1Lines.push(fillRoundedRect("0.96 0.97 0.99", 302, 626, 120, 54, 4));
  page1Lines.push(strokeRoundedRect("0.85 0.88 0.92", 302, 626, 120, 54, 4));
  page1Lines.push(fillRoundedRect("0.82 0.15 0.15", 302, 677, 120, 3, 4));
  page1Lines.push(`BT /F2 7 Tf 0.4 0.45 0.55 rg 310 664 Td (ESTIMATED LOSS) Tj ET`);
  page1Lines.push(`BT /F2 10 Tf 0.7 0.1 0.1 rg 310 648 Td (Rs. ${Math.round(ex.businessLoss?.value || 0).toLocaleString("en-IN")}) Tj ET`);
  page1Lines.push(`BT /F1 7 Tf 0.6 0.1 0.1 rg 310 634 Td (Unconverted Opp.) Tj ET`);

  // Card 8: Unconverted Leads
  page1Lines.push(fillRoundedRect("0.96 0.97 0.99", 433, 626, 122, 54, 4));
  page1Lines.push(strokeRoundedRect("0.85 0.88 0.92", 433, 626, 122, 54, 4));
  page1Lines.push(fillRoundedRect("0.7 0.15 0.55", 433, 677, 122, 3, 4));
  page1Lines.push(`BT /F2 7 Tf 0.4 0.45 0.55 rg 441 664 Td (UNCONVERTED) Tj ET`);
  page1Lines.push(`BT /F2 10 Tf 0.08 0.12 0.25 rg 441 648 Td (${loss.unconvertedLeads || 0} Leads) Tj ET`);
  page1Lines.push(`BT /F1 7 Tf 0.5 0.1 0.4 rg 441 634 Td (Priority Followup) Tj ET`);

  // Section 2: BRAND REVENUE DISTRIBUTION VISUAL HORIZONTAL BAR CHARTS
  let p1Y = 602;
  page1Lines.push(`BT /F2 9.5 Tf 0.08 0.12 0.28 rg 40 ${p1Y} Td (2. BRAND REVENUE DISTRIBUTION & PERFORMANCE VISUAL CHARTS) Tj ET`);
  p1Y -= 14;

  const topBrands = brands.slice(0, 5);
  const maxBrandVal = Math.max(...topBrands.map((b) => b.dailyCollections || 0), 1);
  const barColors = [
    "0.02 0.59 0.41", // Emerald
    "0.14 0.38 0.92", // Royal Blue
    "0.48 0.22 0.93", // Purple
    "0.85 0.45 0.05", // Amber
    "0.02 0.52 0.78", // Cyan
  ];

  topBrands.forEach((b, idx) => {
    const col = barColors[idx % barColors.length];
    const bw = Math.max(12, Math.min(240, ((b.dailyCollections || 0) / maxBrandVal) * 240));

    page1Lines.push(`0.96 0.97 0.99 rg 40 ${p1Y - 14} 515 20 re f`);
    page1Lines.push(`BT /F2 8 Tf 0.1 0.1 0.2 rg 45 ${p1Y - 2} Td (${escapePdfText(b.brandName)}) Tj ET`);

    // Draw visual graphical bar
    page1Lines.push(`${col} rg 170 ${p1Y - 11} ${bw} 14 re f`);
    page1Lines.push(`BT /F2 8 Tf 0.1 0.5 0.2 rg ${180 + bw} ${p1Y - 2} Td (Rs. ${Math.round(b.dailyCollections || 0).toLocaleString("en-IN")}  (${b.admissions} Adm)) Tj ET`);

    p1Y -= 22;
  });

  // Section 3: REVENUE BENCHMARK COMPARISON BAR CHART
  p1Y -= 6;
  page1Lines.push(`BT /F2 9.5 Tf 0.08 0.12 0.28 rg 40 ${p1Y} Td (3. REVENUE BENCHMARK COMPARISON GRAPH) Tj ET`);
  p1Y -= 14;
  page1Lines.push(`0.96 0.97 0.99 rg 40 ${p1Y - 55} 515 58 re f`);
  page1Lines.push(`0.85 0.85 0.85 RG 40 ${p1Y - 55} 515 58 re s`);

  const maxComp = Math.max(comp.today || 0, comp.yesterday || 0, comp.sameDayLastWeek || 0, 1);
  const w1 = Math.max(12, Math.min(310, ((comp.today || 0) / maxComp) * 310));
  const w2 = Math.max(12, Math.min(310, ((comp.yesterday || 0) / maxComp) * 310));
  const w3 = Math.max(12, Math.min(310, ((comp.sameDayLastWeek || 0) / maxComp) * 310));

  // Today Bar
  page1Lines.push(`BT /F2 8 Tf 0.14 0.38 0.92 rg 50 ${p1Y - 14} Td (Today's Revenue:) Tj ET`);
  page1Lines.push(`0.14 0.38 0.92 rg 170 ${p1Y - 16} ${w1} 10 re f`);
  page1Lines.push(`BT /F2 8 Tf 0.1 0.1 0.1 rg ${180 + w1} ${p1Y - 14} Td (Rs. ${Math.round(comp.today || 0).toLocaleString("en-IN")}) Tj ET`);

  // Yesterday Bar
  page1Lines.push(`BT /F2 8 Tf 0.48 0.22 0.93 rg 50 ${p1Y - 30} Td (Yesterday's Revenue:) Tj ET`);
  page1Lines.push(`0.48 0.22 0.93 rg 170 ${p1Y - 32} ${w2} 10 re f`);
  page1Lines.push(`BT /F2 8 Tf 0.1 0.1 0.1 rg ${180 + w2} ${p1Y - 30} Td (Rs. ${Math.round(comp.yesterday || 0).toLocaleString("en-IN")}) Tj ET`);

  // Same Day Last Week Bar
  page1Lines.push(`BT /F2 8 Tf 0.3 0.35 0.45 rg 50 ${p1Y - 46} Td (Same Day Last Wk:) Tj ET`);
  page1Lines.push(`0.3 0.35 0.45 rg 170 ${p1Y - 48} ${w3} 10 re f`);
  page1Lines.push(`BT /F2 8 Tf 0.1 0.1 0.1 rg ${180 + w3} ${p1Y - 46} Td (Rs. ${Math.round(comp.sameDayLastWeek || 0).toLocaleString("en-IN")}) Tj ET`);

  p1Y -= 65;

  // Section 4: LEAD CONVERSION FUNNEL DIAGRAM VISUALS
  page1Lines.push(`BT /F2 9.5 Tf 0.08 0.12 0.28 rg 40 ${p1Y} Td (4. LEAD CONVERSION FUNNEL & VISUAL STAGE DIAGRAM) Tj ET`);
  p1Y -= 14;
  page1Lines.push(`0.98 0.98 0.98 rg 40 ${p1Y - 78} 515 82 re f`);
  page1Lines.push(`0.85 0.85 0.85 RG 40 ${p1Y - 78} 515 82 re s`);

  // Funnel Stage 1
  page1Lines.push(`0.28 0.35 0.92 rg 50 ${p1Y - 16} 450 11 re f`);
  page1Lines.push(`BT /F2 8 Tf 1 1 1 rg 55 ${p1Y - 14} Td (1. Leads Received: ${funnel.leadsReceived}  |  Drop-off to Followup: ${funnel.dropOffRates?.postLeadDropOff || 0}%) Tj ET`);

  // Funnel Stage 2
  page1Lines.push(`0.02 0.52 0.78 rg 50 ${p1Y - 34} ${Math.max(30, Math.min(450, ((funnel.stagePercentages?.followupPct || 0) / 100) * 450))} 11 re f`);
  page1Lines.push(`BT /F2 8 Tf 1 1 1 rg 55 ${p1Y - 32} Td (2. Followups Completed: ${funnel.followupsCompleted} (${funnel.stagePercentages?.followupPct || 0}%)  |  Drop-off to Demo: ${funnel.dropOffRates?.postFollowupDropOff || 0}%) Tj ET`);

  // Funnel Stage 3
  page1Lines.push(`0.55 0.25 0.85 rg 50 ${p1Y - 52} ${Math.max(30, Math.min(450, ((funnel.stagePercentages?.demoPct || 0) / 100) * 450))} 11 re f`);
  page1Lines.push(`BT /F2 8 Tf 1 1 1 rg 55 ${p1Y - 50} Td (3. Demos Scheduled: ${funnel.demosScheduled} (${funnel.stagePercentages?.demoPct || 0}%)  |  Drop-off to Admission: ${funnel.dropOffRates?.postDemoDropOff || 0}%) Tj ET`);

  // Funnel Stage 4
  page1Lines.push(`0.02 0.59 0.41 rg 50 ${p1Y - 70} ${Math.max(30, Math.min(450, ((funnel.stagePercentages?.admissionPct || 0) / 100) * 450))} 11 re f`);
  page1Lines.push(`BT /F2 8 Tf 1 1 1 rg 55 ${p1Y - 68} Td (4. Admissions Confirmed: ${funnel.admissionsConfirmed} (Final Conversion: ${funnel.stagePercentages?.admissionPct || 0}%)) Tj ET`);

  page1Lines.push(fillRoundedRect("0.85 0.85 0.85", 40, 45, 515, 1, 4));
  page1Lines.push(`BT /F1 8 Tf 0.5 0.5 0.5 rg 40 30 Td (CoachFlow ERP - Executive BI Master Report - Page 1 of 2) Tj ET`);

  // ==========================================
  // PAGE 2: COUNSELLORS + MARKETING ROI + OVERDUE EMIS + PREDICTIVE TARGETS + AI SYNTHESIS
  // ==========================================
  const page2Lines: string[] = [
    fillRoundedRect("0.08 0.12 0.28", 30, 772, 535, 52, 4),
    `BT /F2 13.5 Tf 1 1 1 rg 45 802 Td (COACHFLOW ERP - SALES EXECUTIVE, FINANCIAL & AI SYNTHESIS) Tj ET`,
    `BT /F1 8 Tf 0.85 0.9 0.98 rg 45 786 Td (Report Date: ${dateStr}    |    Page 2 of 2) Tj ET`,

    // Section 5: Counsellor Performance Dashboard
    `BT /F2 9.5 Tf 0.08 0.12 0.28 rg 40 754 Td (5. COUNSELLOR / SALES EXECUTIVE PERFORMANCE SCORECARD) Tj ET`,
    fillRoundedRect("0.12 0.18 0.38", 40, 734, 515, 16, 4),
    `BT /F2 8 Tf 1 1 1 rg 45 738 Td (Sales Executive Name) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 180 738 Td (Scope) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 240 738 Td (Leads) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 285 738 Td (Admissions) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 345 738 Td (Conv %) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 395 738 Td (Collections) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 475 738 Td (Performance) Tj ET`,
  ];

  let p2Y = 720;
  counsellors.slice(0, 5).forEach((cs, idx) => {
    const bg = idx % 2 === 0 ? "0.96 0.97 0.99" : "1 1 1";
    page2Lines.push(`${bg} rg 40 ${p2Y} 515 14 re f`);
    page2Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 45 ${p2Y + 3} Td (${escapePdfText(cs.name)}) Tj ET`);
    page2Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 180 ${p2Y + 3} Td (${escapePdfText(cs.brandScope)}) Tj ET`);
    page2Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 240 ${p2Y + 3} Td (${cs.leadsAssigned}) Tj ET`);
    page2Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 285 ${p2Y + 3} Td (${cs.admissionsConverted}) Tj ET`);
    page2Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 345 ${p2Y + 3} Td (${cs.conversionPct}%) Tj ET`);
    page2Lines.push(`BT /F2 7.5 Tf 0.1 0.5 0.2 rg 395 ${p2Y + 3} Td (Rs. ${Math.round(cs.collectionsGenerated || 0).toLocaleString("en-IN")}) Tj ET`);

    const tagCol = cs.isTopPerformer ? "0.02 0.59 0.41" : cs.isLowPerformer ? "0.85 0.45 0.05" : "0.14 0.38 0.92";
    const tag = cs.isTopPerformer ? "Top Performer" : cs.isLowPerformer ? "Low Velocity" : "Active";
    page2Lines.push(`${tagCol} rg 475 ${p2Y + 1} 60 11 re f`);
    page2Lines.push(`BT /F2 6.5 Tf 1 1 1 rg 478 ${p2Y + 3} Td (${tag}) Tj ET`);
    p2Y -= 14;
  });

  // Section 6 & 7: Lead Source & Payment Modes
  p2Y -= 10;
  page2Lines.push(`BT /F2 9.5 Tf 0.08 0.12 0.28 rg 40 ${p2Y} Td (6. MARKETING SOURCE ROI & PAYMENT MODE DISTRIBUTION) Tj ET`);
  p2Y -= 16;

  page2Lines.push(`0.2 0.5 0.8 rg 40 ${p2Y} 250 16 re f`);
  page2Lines.push(`BT /F2 8 Tf 1 1 1 rg 45 ${p2Y + 4} Td (Lead Source Channel) Tj ET`);
  page2Lines.push(`BT /F2 8 Tf 1 1 1 rg 135 ${p2Y + 4} Td (Leads) Tj ET`);
  page2Lines.push(`BT /F2 8 Tf 1 1 1 rg 165 ${p2Y + 4} Td (Adm) Tj ET`);
  page2Lines.push(`BT /F2 8 Tf 1 1 1 rg 195 ${p2Y + 4} Td (Revenue (INR)) Tj ET`);

  page2Lines.push(`0.1 0.6 0.3 rg 300 ${p2Y} 255 16 re f`);
  page2Lines.push(`BT /F2 8 Tf 1 1 1 rg 305 ${p2Y + 4} Td (Payment Mode) Tj ET`);
  page2Lines.push(`BT /F2 8 Tf 1 1 1 rg 405 ${p2Y + 4} Td (Amount Received) Tj ET`);
  page2Lines.push(`BT /F2 8 Tf 1 1 1 rg 505 ${p2Y + 4} Td (Share %) Tj ET`);

  p2Y -= 14;
  const maxRows = Math.max(sources.length, modes.length, 3);

  for (let i = 0; i < Math.min(maxRows, 4); i++) {
    const s = sources[i];
    const m = modes[i];

    const bg1 = i % 2 === 0 ? "0.97 0.98 1" : "1 1 1";
    page2Lines.push(`${bg1} rg 40 ${p2Y} 250 14 re f`);
    if (s) {
      page2Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 45 ${p2Y + 3} Td (${escapePdfText(s.source)}) Tj ET`);
      page2Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 135 ${p2Y + 3} Td (${s.leadsGenerated}) Tj ET`);
      page2Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 165 ${p2Y + 3} Td (${s.admissions}) Tj ET`);
      page2Lines.push(`BT /F1 7.5 Tf 0.1 0.4 0.2 rg 195 ${p2Y + 3} Td (Rs. ${Math.round(s.revenueContribution || 0).toLocaleString("en-IN")}) Tj ET`);
    }

    const bg2 = i % 2 === 0 ? "0.96 0.99 0.96" : "1 1 1";
    page2Lines.push(`${bg2} rg 300 ${p2Y} 255 14 re f`);
    if (m) {
      page2Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 305 ${p2Y + 3} Td (${escapePdfText(m.mode)}) Tj ET`);
      page2Lines.push(`BT /F1 7.5 Tf 0.1 0.4 0.2 rg 405 ${p2Y + 3} Td (Rs. ${Math.round(m.amount || 0).toLocaleString("en-IN")}) Tj ET`);
      page2Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 505 ${p2Y + 3} Td (${m.percentage}%) Tj ET`);
    }
    p2Y -= 14;
  }

  // Section 8: PENDING FEE & OVERDUE EMI PRIORITY LIST
  p2Y -= 10;
  page2Lines.push(`BT /F2 9.5 Tf 0.08 0.12 0.28 rg 40 ${p2Y} Td (7. PENDING FEE & OVERDUE EMI PRIORITY FOLLOW-UP LIST) Tj ET`);
  p2Y -= 16;
  page2Lines.push(`0.7 0.2 0.2 rg 40 ${p2Y} 515 16 re f`);
  page2Lines.push(`BT /F2 8 Tf 1 1 1 rg 45 ${p2Y + 4} Td (Student Name) Tj ET`);
  page2Lines.push(`BT /F2 8 Tf 1 1 1 rg 190 ${p2Y + 4} Td (Course) Tj ET`);
  page2Lines.push(`BT /F2 8 Tf 1 1 1 rg 310 ${p2Y + 4} Td (Mobile Phone) Tj ET`);
  page2Lines.push(`BT /F2 8 Tf 1 1 1 rg 420 ${p2Y + 4} Td (Overdue Balance) Tj ET`);
  page2Lines.push(`BT /F2 8 Tf 1 1 1 rg 490 ${p2Y + 4} Td (Due Date) Tj ET`);

  p2Y -= 14;
  (pending.studentsRequiringFollowup || []).slice(0, 4).forEach((st, idx) => {
    const bg = idx % 2 === 0 ? "0.99 0.96 0.96" : "1 1 1";
    page2Lines.push(`${bg} rg 40 ${p2Y} 515 14 re f`);
    page2Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 45 ${p2Y + 3} Td (${escapePdfText(st.fullName)}) Tj ET`);
    page2Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 190 ${p2Y + 3} Td (${escapePdfText(st.course)}) Tj ET`);
    page2Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 310 ${p2Y + 3} Td (${escapePdfText(st.mobileNumber)}) Tj ET`);
    page2Lines.push(`BT /F2 7.5 Tf 0.7 0.1 0.1 rg 420 ${p2Y + 3} Td (Rs. ${Math.round(st.remainingBalance || 0).toLocaleString("en-IN")}) Tj ET`);
    page2Lines.push(`BT /F1 7.5 Tf 0.3 0.3 0.3 rg 490 ${p2Y + 3} Td (${escapePdfText(st.nextDueDate)}) Tj ET`);
    p2Y -= 14;
  });

  // Section 9: PREDICTIVE TARGET PROGRESS BARS
  p2Y -= 8;
  page2Lines.push(`BT /F2 9.5 Tf 0.08 0.12 0.28 rg 40 ${p2Y} Td (8. TOMORROW'S PREDICTIVE BUSINESS TARGETS & PROGRESS BARS) Tj ET`);
  p2Y -= 14;
  page2Lines.push(`0.96 0.97 0.99 rg 40 ${p2Y - 42} 515 48 re f`);
  page2Lines.push(`0.85 0.85 0.85 RG 40 ${p2Y - 42} 515 48 re s`);

  page2Lines.push(`BT /F2 7.5 Tf 0.2 0.2 0.7 rg 50 ${p2Y - 12} Td (Revenue Target: Rs. ${Math.round(targets.revenueTarget || 0).toLocaleString("en-IN")}) Tj ET`);
  page2Lines.push(`BT /F2 7.5 Tf 0.1 0.5 0.2 rg 220 ${p2Y - 12} Td (Collections Target: Rs. ${Math.round(targets.collectionsTarget || 0).toLocaleString("en-IN")}) Tj ET`);
  page2Lines.push(`BT /F2 7.5 Tf 0.5 0.2 0.7 rg 390 ${p2Y - 12} Td (Admissions Goal: ${targets.admissionsTarget} Students) Tj ET`);

  page2Lines.push(`0.2 0.2 0.7 rg 50 ${p2Y - 18} 120 4 re f`);
  page2Lines.push(`0.1 0.5 0.2 rg 220 ${p2Y - 18} 120 4 re f`);
  page2Lines.push(`0.5 0.2 0.7 rg 390 ${p2Y - 18} 120 4 re f`);

  page2Lines.push(`BT /F2 7.5 Tf 0.2 0.4 0.8 rg 50 ${p2Y - 30} Td (Lead Followups: ${targets.leadFollowupsTarget} Calls) Tj ET`);
  page2Lines.push(`BT /F2 7.5 Tf 0.6 0.4 0.1 rg 220 ${p2Y - 30} Td (Demo Sessions: ${targets.demoSessionsTarget} Bookings) Tj ET`);
  page2Lines.push(`BT /F2 7.5 Tf 0.7 0.2 0.2 rg 390 ${p2Y - 30} Td (EMI Recovery: Rs. ${Math.round(targets.pendingFeeRecoveryTarget || 0).toLocaleString("en-IN")}) Tj ET`);

  page2Lines.push(`0.2 0.4 0.8 rg 50 ${p2Y - 36} 120 4 re f`);
  page2Lines.push(`0.6 0.4 0.1 rg 220 ${p2Y - 36} 120 4 re f`);
  page2Lines.push(`0.7 0.2 0.2 rg 390 ${p2Y - 36} 120 4 re f`);

  p2Y -= 55;

  // Section 10: AI BUSINESS INSIGHTS EXECUTIVE SYNTHESIS DARK CARD
  page2Lines.push(`BT /F2 9.5 Tf 0.08 0.12 0.28 rg 40 ${p2Y} Td (9. AI BUSINESS INSIGHTS & STRATEGIC EXECUTIVE SYNTHESIS) Tj ET`);
  p2Y -= 14;
  page2Lines.push(`0.06 0.09 0.16 rg 40 ${p2Y - 185} 515 185 re f`);

  page2Lines.push(`BT /F2 9 Tf 0.34 0.8 0.95 rg 52 ${p2Y - 16} Td (AUTOMATED EXECUTIVE OBSERVATION SUMMARY) Tj ET`);
  page2Lines.push(`BT /F1 7.5 Tf 1 1 1 rg 52 ${p2Y - 28} Td (${escapePdfText(ai.executiveSummary || "Continuous monitoring active across all academic & financial CRM streams.")}) Tj ET`);

  page2Lines.push(`BT /F2 8.5 Tf 0.4 0.9 0.5 rg 52 ${p2Y - 48} Td (KEY OPERATIONAL ACHIEVEMENTS) Tj ET`);
  let aY = p2Y - 60;
  (ai.keyAchievements || []).slice(0, 3).forEach((ach) => {
    page2Lines.push(`BT /F1 7.5 Tf 1 1 1 rg 58 ${aY} Td (* ${escapePdfText(ach)}) Tj ET`);
    aY -= 12;
  });

  aY -= 4;
  page2Lines.push(`BT /F2 8.5 Tf 1 0.7 0.3 rg 52 ${aY} Td (RECOMMENDED PRIORITY ACTIONS FOR TOMORROW) Tj ET`);
  aY -= 12;
  (ai.recommendedPriorityActions || []).slice(0, 3).forEach((act) => {
    page2Lines.push(`BT /F1 7.5 Tf 1 1 1 rg 58 ${aY} Td (* ${escapePdfText(act)}) Tj ET`);
    aY -= 12;
  });

  page2Lines.push(fillRoundedRect("0.85 0.85 0.85", 40, 45, 515, 1, 4));
  page2Lines.push(`BT /F1 8 Tf 0.5 0.5 0.5 rg 40 30 Td (CoachFlow Decision Support Engine v3.2   |   Official Executive Master Report) Tj ET`);
  page2Lines.push(`BT /F1 8 Tf 0.5 0.5 0.5 rg 450 30 Td (Page 2 of 2) Tj ET`);

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
