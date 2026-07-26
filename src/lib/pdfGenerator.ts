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
    `360 742 180 25 rectfill`,
    `1 1 1 rg`,
    `365 742 3 25 rectfill`, `372 742 2 25 rectfill`, `378 742 4 25 rectfill`,
    `386 742 2 25 rectfill`, `392 742 5 25 rectfill`, `402 742 3 25 rectfill`,
    `410 742 2 25 rectfill`, `416 742 4 25 rectfill`, `425 742 3 25 rectfill`,
    `433 742 5 25 rectfill`, `442 742 2 25 rectfill`, `450 742 4 25 rectfill`,
    `460 742 3 25 rectfill`, `470 742 2 25 rectfill`, `480 742 5 25 rectfill`,

    // Top Divider Line
    `0.85 0.85 0.85 rg 50 730 495 1 rectfill`,

    // Left Column Meta Box
    `0.96 0.96 0.96 rg 50 625 240 95 rectfill`,
    `0.85 0.85 0.85 rg 50 625 240 95 rectstroke`,
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
    `0.85 0.85 0.85 rg 305 700 240 20 rectfill`,
    `BT /F2 9 Tf 0.2 0.2 0.2 rg 310 706 Td (Received From :) Tj ET`,
    `BT /F2 10 Tf 0.1 0.1 0.1 rg 305 684 Td (${student}) Tj ET`,
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 305 669 Td (Admission Batch : Lucknow) Tj ET`,
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 305 654 Td (Lucknow) Tj ET`,

    // Solid Green Amount Pill
    `0.15 0.68 0.32 rg 305 625 240 22 rectfill`,
    `BT /F2 12 Tf 1 1 1 rg 400 632 Td (INR ${amountStr}) Tj ET`,

    // Invoice Details Section
    `BT /F2 10 Tf 0.1 0.1 0.1 rg 50 605 Td (Invoice Details) Tj ET`,
    `0.82 0.82 0.82 rg 50 585 495 18 rectfill`,
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
    `0.82 0.82 0.82 rg 50 525 495 18 rectfill`,
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
    `0.88 0.88 0.88 rg 50 490 495 16 rectfill`,
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
    `0.5 0.5 0.5 rg 380 620 150 1 rectfill`,
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
  // PAGE 1: HEADER + EXECUTIVE KPIs + 14-DAY REVENUE TREND TABLE + REVENUE COMPARISON
  // ==========================================
  const page1Lines: string[] = [
    // Header Banner
    `BT /F2 16 Tf 0.12 0.11 0.29 rg 40 805 Td (CoachFlow ERP - Executive Daily Business Intelligence Report) Tj ET`,
    `BT /F1 8.5 Tf 0.4 0.4 0.4 rg 40 792 Td (Report Date: ${dateStr}    |    Generated at: ${genAtStr}) Tj ET`,
    `0.12 0.11 0.29 rg 40 782 515 2 rectfill`,

    // Section 1: Executive KPI Grid (8 Cards with % vs Yesterday)
    `BT /F2 9.5 Tf 0.1 0.1 0.1 rg 40 766 Td (1. EXECUTIVE SUMMARY KEY PERFORMANCE INDICATORS) Tj ET`,
    `0.97 0.97 0.99 rg 40 686 515 70 rectfill`,
    `0.85 0.85 0.85 rg 40 686 515 70 rectstroke`,

    `BT /F2 7.5 Tf 0.2 0.2 0.7 rg 45 742 Td (TOTAL REVENUE) Tj ET`,
    `BT /F2 8 Tf 0.1 0.1 0.1 rg 45 730 Td (Rs. ${Math.round(ex.totalRevenue?.value || 0).toLocaleString("en-IN")}) Tj ET`,
    `BT /F1 7 Tf 0.1 0.5 0.2 rg 45 718 Td (${formatChange(ex.totalRevenue?.changePct || 0)} vs yest) Tj ET`,

    `BT /F2 7.5 Tf 0.1 0.5 0.2 rg 170 742 Td (TOTAL COLLECTIONS) Tj ET`,
    `BT /F2 8 Tf 0.1 0.1 0.1 rg 170 730 Td (Rs. ${Math.round(ex.totalCollections?.value || 0).toLocaleString("en-IN")}) Tj ET`,
    `BT /F1 7 Tf 0.1 0.5 0.2 rg 170 718 Td (${formatChange(ex.totalCollections?.changePct || 0)} vs yest) Tj ET`,

    `BT /F2 7.5 Tf 0.2 0.4 0.8 rg 310 742 Td (TOTAL LEADS) Tj ET`,
    `BT /F2 8 Tf 0.1 0.1 0.1 rg 310 730 Td (${ex.totalLeads?.value || 0}) Tj ET`,
    `BT /F1 7 Tf 0.1 0.5 0.2 rg 310 718 Td (${formatChange(ex.totalLeads?.changePct || 0)} vs yest) Tj ET`,

    `BT /F2 7.5 Tf 0.5 0.2 0.7 rg 430 742 Td (ADMISSIONS) Tj ET`,
    `BT /F2 8 Tf 0.1 0.1 0.1 rg 430 730 Td (${ex.admissions?.value || 0}) Tj ET`,
    `BT /F1 7 Tf 0.1 0.5 0.2 rg 430 718 Td (${formatChange(ex.admissions?.changePct || 0)} vs yest) Tj ET`,

    `BT /F2 7.5 Tf 0.6 0.4 0.1 rg 45 702 Td (CONVERSION RATE) Tj ET`,
    `BT /F2 8 Tf 0.1 0.1 0.1 rg 45 692 Td (${ex.conversionRate?.value || 0}%) Tj ET`,

    `BT /F2 7.5 Tf 0.3 0.3 0.3 rg 170 702 Td (OUTSTANDING FEES) Tj ET`,
    `BT /F2 8 Tf 0.1 0.1 0.1 rg 170 692 Td (Rs. ${Math.round(ex.outstandingFees?.value || 0).toLocaleString("en-IN")}) Tj ET`,

    `BT /F2 7.5 Tf 0.7 0.2 0.2 rg 310 702 Td (ESTIMATED LOSS) Tj ET`,
    `BT /F2 8 Tf 0.1 0.1 0.1 rg 310 692 Td (Rs. ${Math.round(ex.businessLoss?.value || 0).toLocaleString("en-IN")}) Tj ET`,

    `BT /F2 7.5 Tf 0.4 0.2 0.6 rg 430 702 Td (UNCONVERTED) Tj ET`,
    `BT /F2 8 Tf 0.1 0.1 0.1 rg 430 692 Td (${loss.unconvertedLeads || 0} Leads) Tj ET`,

    // Section 2: 14-30 Day Daily Revenue & Collection Trend Table with Visual Bar Graphs
    `BT /F2 9.5 Tf 0.1 0.1 0.1 rg 40 668 Td (2. DAILY REVENUE & COLLECTION HISTORICAL TREND (14 DAYS) + VISUAL BARS) Tj ET`,
    `0.2 0.3 0.6 rg 40 648 515 16 rectfill`,
    `BT /F2 8 Tf 1 1 1 rg 45 652 Td (Date) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 130 652 Td (Total Revenue (INR)) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 240 652 Td (Collections (INR)) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 350 652 Td (Visual Trend Graph) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 445 652 Td (Adm) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 490 652 Td (Leads) Tj ET`,
  ];

  let trY = 632;
  const maxTrendRev = Math.max(...trend.slice(0, 10).map((t) => t.revenue || 0), 1);

  trend.slice(0, 10).forEach((t, idx) => {
    const bg = idx % 2 === 0 ? "0.97 0.98 1" : "1 1 1";
    page1Lines.push(`${bg} rg 40 ${trY} 515 15 rectfill`);
    page1Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 45 ${trY + 3} Td (${escapePdfText(t.date)}) Tj ET`);
    page1Lines.push(`BT /F2 7.5 Tf 0.2 0.2 0.6 rg 130 ${trY + 3} Td (Rs. ${Math.round(t.revenue || 0).toLocaleString("en-IN")}) Tj ET`);
    page1Lines.push(`BT /F2 7.5 Tf 0.1 0.5 0.2 rg 240 ${trY + 3} Td (Rs. ${Math.round(t.collections || 0).toLocaleString("en-IN")}) Tj ET`);

    // Draw Vector Bar Graphic for Trend Magnitude
    const barWidth = Math.max(10, Math.min(80, ((t.revenue || 0) / maxTrendRev) * 80));
    page1Lines.push(`0.31 0.27 0.9 rg 350 ${trY + 3} ${barWidth} 8 rectfill`);

    page1Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 445 ${trY + 3} Td (${t.admissions}) Tj ET`);
    page1Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 490 ${trY + 3} Td (${t.leads}) Tj ET`);
    trY -= 15;
  });

  // Section 3: Revenue Comparison Benchmark Box with Progress Indicators
  trY -= 15;
  page1Lines.push(`BT /F2 9.5 Tf 0.1 0.1 0.1 rg 40 ${trY} Td (3. REVENUE COMPARISON BENCHMARK & PERFORMANCE VISUALS) Tj ET`);
  trY -= 20;
  page1Lines.push(`0.96 0.97 0.99 rg 40 ${trY - 35} 515 42 rectfill`);
  page1Lines.push(`0.85 0.85 0.85 rg 40 ${trY - 35} 515 42 rectstroke`);

  page1Lines.push(`BT /F2 8.5 Tf 0.2 0.2 0.7 rg 50 ${trY - 15} Td (Today's Revenue: Rs. ${Math.round(comp.today || 0).toLocaleString("en-IN")}) Tj ET`);
  page1Lines.push(`BT /F2 8.5 Tf 0.4 0.2 0.6 rg 220 ${trY - 15} Td (Yesterday: Rs. ${Math.round(comp.yesterday || 0).toLocaleString("en-IN")}) Tj ET`);
  page1Lines.push(`BT /F2 8.5 Tf 0.3 0.3 0.3 rg 390 ${trY - 15} Td (Same Day Last Wk: Rs. ${Math.round(comp.sameDayLastWeek || 0).toLocaleString("en-IN")}) Tj ET`);

  const maxComp = Math.max(comp.today || 0, comp.yesterday || 0, comp.sameDayLastWeek || 0, 1);
  const w1 = Math.max(8, Math.min(130, ((comp.today || 0) / maxComp) * 130));
  const w2 = Math.max(8, Math.min(130, ((comp.yesterday || 0) / maxComp) * 130));
  const w3 = Math.max(8, Math.min(130, ((comp.sameDayLastWeek || 0) / maxComp) * 130));

  page1Lines.push(`0.2 0.2 0.7 rg 50 ${trY - 28} ${w1} 6 rectfill`);
  page1Lines.push(`0.4 0.2 0.6 rg 220 ${trY - 28} ${w2} 6 rectfill`);
  page1Lines.push(`0.3 0.3 0.3 rg 390 ${trY - 28} ${w3} 6 rectfill`);

  page1Lines.push(`0.85 0.85 0.85 rg 40 45 515 1 rectfill`);
  page1Lines.push(`BT /F1 8 Tf 0.5 0.5 0.5 rg 40 30 Td (CoachFlow ERP - Executive BI Master Report - Page 1 of 4) Tj ET`);

  // ==========================================
  // PAGE 2: CONVERSION FUNNEL + BUSINESS LOSS FORMULA + BRAND PERFORMANCE TABLE
  // ==========================================
  const page2Lines: string[] = [
    `BT /F2 16 Tf 0.12 0.11 0.29 rg 40 805 Td (CoachFlow ERP - Conversion Funnel & Brand Performance) Tj ET`,
    `BT /F1 8.5 Tf 0.4 0.4 0.4 rg 40 792 Td (Report Date: ${dateStr}    |    Page 2 of 4) Tj ET`,
    `0.12 0.11 0.29 rg 40 782 515 2 rectfill`,

    // Section 4: Lead Conversion Funnel with Cascading Visual Stage Bars
    `BT /F2 9.5 Tf 0.1 0.1 0.1 rg 40 766 Td (4. LEAD CONVERSION FUNNEL & VISUAL STAGE DROP-OFF DIAGRAM) Tj ET`,
    `0.98 0.98 0.98 rg 40 670 515 86 rectfill`,
    `0.85 0.85 0.85 rg 40 670 515 86 rectstroke`,

    // Funnel Stage 1 Bar
    `0.31 0.27 0.9 rg 50 738 450 8 rectfill`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 50 748 Td (1. Leads Received: ${funnel.leadsReceived}  |  Drop-off to Followup: ${funnel.dropOffRates?.postLeadDropOff || 0}%) Tj ET`,

    // Funnel Stage 2 Bar
    `0.1 0.5 0.9 rg 50 716 ${Math.max(20, Math.min(450, ((funnel.stagePercentages?.followupPct || 0) / 100) * 450))} 8 rectfill`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 50 726 Td (2. Followups Completed: ${funnel.followupsCompleted} (${funnel.stagePercentages?.followupPct || 0}%)  |  Drop-off to Demo: ${funnel.dropOffRates?.postFollowupDropOff || 0}%) Tj ET`,

    // Funnel Stage 3 Bar
    `0.5 0.2 0.8 rg 50 694 ${Math.max(20, Math.min(450, ((funnel.stagePercentages?.demoPct || 0) / 100) * 450))} 8 rectfill`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 50 704 Td (3. Demos Scheduled: ${funnel.demosScheduled} (${funnel.stagePercentages?.demoPct || 0}%)  |  Drop-off to Admission: ${funnel.dropOffRates?.postDemoDropOff || 0}%) Tj ET`,

    // Funnel Stage 4 Bar
    `0.02 0.59 0.41 rg 50 672 ${Math.max(20, Math.min(450, ((funnel.stagePercentages?.admissionPct || 0) / 100) * 450))} 8 rectfill`,
    `BT /F2 8.5 Tf 0.1 0.5 0.2 rg 50 682 Td (4. Admissions Confirmed: ${funnel.admissionsConfirmed} (Final Conversion: ${funnel.stagePercentages?.admissionPct || 0}%)) Tj ET`,

    // Section 5: Business Loss Analysis
    `BT /F2 9.5 Tf 0.1 0.1 0.1 rg 40 652 Td (5. UNREALIZED REVENUE & DEDICATED BUSINESS LOSS ANALYSIS) Tj ET`,
    `0.99 0.95 0.95 rg 40 584 515 58 rectfill`,
    `0.9 0.8 0.8 rg 40 584 515 58 rectstroke`,
    `BT /F1 8.5 Tf 0.7 0.2 0.2 rg 50 626 Td (Business Loss Formula: (${loss.totalLeads} Total Leads - ${loss.totalAdmissions} Admissions) x Avg Value Rs. ${Math.round(loss.avgAdmissionValue || 0).toLocaleString("en-IN")}) Tj ET`,
    `BT /F2 11 Tf 0.8 0.1 0.1 rg 50 608 Td (Estimated Business Loss = Rs. ${Math.round(loss.estimatedBusinessLoss || 0).toLocaleString("en-IN")}) Tj ET`,
    `BT /F1 8 Tf 0.3 0.3 0.3 rg 50 592 Td (Potential Revenue: Rs. ${Math.round(loss.potentialRevenue || 0).toLocaleString("en-IN")}   |   Actual: Rs. ${Math.round(loss.actualRevenue || 0).toLocaleString("en-IN")}   |   Lost Opp: ${loss.lostOpportunityPct || 0}%) Tj ET`,

    // Section 6: Brand Performance Table with Collection Bars
    `BT /F2 9.5 Tf 0.1 0.1 0.1 rg 40 566 Td (6. BRAND PERFORMANCE BREAKDOWN & COLLECTION VISUAL BARS) Tj ET`,
    `0.31 0.27 0.9 rg 40 546 515 16 rectfill`,
    `BT /F2 8 Tf 1 1 1 rg 45 550 Td (Brand Name) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 170 550 Td (Total Leads) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 230 550 Td (Admissions) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 290 550 Td (Daily Collections (INR)) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 405 550 Td (Conv %) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 460 550 Td (Business Loss) Tj ET`,
  ];

  let bpY = 530;
  const maxBrandColl = Math.max(...brands.slice(0, 12).map((b) => b.dailyCollections || 0), 1);

  brands.slice(0, 12).forEach((b, idx) => {
    const bg = idx % 2 === 0 ? "0.98 0.98 0.99" : "1 1 1";
    page2Lines.push(`${bg} rg 40 ${bpY} 515 16 rectfill`);
    page2Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 45 ${bpY + 4} Td (${escapePdfText(b.brandName)}) Tj ET`);
    page2Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 170 ${bpY + 4} Td (${b.totalLeads}) Tj ET`);
    page2Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 230 ${bpY + 4} Td (${b.admissions}) Tj ET`);
    page2Lines.push(`BT /F2 8 Tf 0.1 0.5 0.2 rg 290 ${bpY + 4} Td (Rs. ${Math.round(b.dailyCollections || 0).toLocaleString("en-IN")}) Tj ET`);

    page2Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 405 ${bpY + 4} Td (${b.conversionRate}%) Tj ET`);
    page2Lines.push(`BT /F1 8 Tf 0.7 0.2 0.2 rg 460 ${bpY + 4} Td (Rs. ${Math.round(b.estimatedBusinessLoss || 0).toLocaleString("en-IN")}) Tj ET`);
    bpY -= 16;
  });

  page2Lines.push(`0.85 0.85 0.85 rg 40 45 515 1 rectfill`);
  page2Lines.push(`BT /F1 8 Tf 0.5 0.5 0.5 rg 40 30 Td (CoachFlow ERP - Executive BI Master Report - Page 2 of 4) Tj ET`);

  // ==========================================
  // PAGE 3: COUNSELLORS + LEAD SOURCES + PAYMENT MODES + OVERDUE EMIS
  // ==========================================
  const page3Lines: string[] = [
    `BT /F2 16 Tf 0.12 0.11 0.29 rg 40 805 Td (CoachFlow ERP - Sales Executive & Financial Breakdown) Tj ET`,
    `BT /F1 8.5 Tf 0.4 0.4 0.4 rg 40 792 Td (Report Date: ${dateStr}    |    Page 3 of 4) Tj ET`,
    `0.12 0.11 0.29 rg 40 782 515 2 rectfill`,

    // Section 7: Counsellor Performance Dashboard Table with Progress Indicators
    `BT /F2 9.5 Tf 0.1 0.1 0.1 rg 40 766 Td (7. COUNSELLOR / SALES EXECUTIVE PERFORMANCE DASHBOARD) Tj ET`,
    `0.48 0.22 0.93 rg 40 746 515 16 rectfill`,
    `BT /F2 8 Tf 1 1 1 rg 45 750 Td (Sales Executive Name) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 180 750 Td (Scope) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 240 750 Td (Leads) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 285 750 Td (Admissions) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 345 750 Td (Conv %) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 395 750 Td (Collections) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 475 750 Td (Performance) Tj ET`,
  ];

  let cpY = 730;
  const maxCounsellorColl = Math.max(...counsellors.slice(0, 10).map((c) => c.collectionsGenerated || 0), 1);

  counsellors.slice(0, 10).forEach((cs, idx) => {
    const bg = idx % 2 === 0 ? "0.98 0.97 0.99" : "1 1 1";
    page3Lines.push(`${bg} rg 40 ${cpY} 515 16 rectfill`);
    page3Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 45 ${cpY + 4} Td (${escapePdfText(cs.name)}) Tj ET`);
    page3Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 180 ${cpY + 4} Td (${escapePdfText(cs.brandScope)}) Tj ET`);
    page3Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 240 ${cpY + 4} Td (${cs.leadsAssigned}) Tj ET`);
    page3Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 285 ${cpY + 4} Td (${cs.admissionsConverted}) Tj ET`);
    page3Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 345 ${cpY + 4} Td (${cs.conversionPct}%) Tj ET`);
    page3Lines.push(`BT /F2 8 Tf 0.1 0.5 0.2 rg 395 ${cpY + 4} Td (Rs. ${Math.round(cs.collectionsGenerated || 0).toLocaleString("en-IN")}) Tj ET`);

    const tag = cs.isTopPerformer ? "Top Performer" : cs.isLowPerformer ? "Low Velocity" : "Active";
    page3Lines.push(`BT /F1 7.5 Tf 0.3 0.3 0.3 rg 475 ${cpY + 4} Td (${tag}) Tj ET`);
    cpY -= 16;
  });

  // Section 8 & 9: Lead Source Analysis & Collection Summary by Mode with Visual Bars
  cpY -= 10;
  page3Lines.push(`BT /F2 9.5 Tf 0.1 0.1 0.1 rg 40 ${cpY} Td (8. LEAD SOURCE ANALYSIS (MARKETING ROI) & PAYMENT MODES WITH BARS) Tj ET`);
  cpY -= 20;

  page3Lines.push(`0.2 0.5 0.8 rg 40 ${cpY} 250 16 rectfill`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 45 ${cpY + 4} Td (Lead Source Channel) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 135 ${cpY + 4} Td (Leads) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 165 ${cpY + 4} Td (Adm) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 195 ${cpY + 4} Td (Revenue (INR)) Tj ET`);

  page3Lines.push(`0.1 0.6 0.3 rg 300 ${cpY} 255 16 rectfill`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 305 ${cpY + 4} Td (Payment Mode) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 405 ${cpY + 4} Td (Amount Received) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 505 ${cpY + 4} Td (Share %) Tj ET`);

  cpY -= 16;
  const maxRows = Math.max(sources.length, modes.length, 4);
  const maxSrcRev = Math.max(...sources.map((s) => s.revenueContribution || 0), 1);
  const maxModeAmt = Math.max(...modes.map((m) => m.amount || 0), 1);

  for (let i = 0; i < Math.min(maxRows, 5); i++) {
    const s = sources[i];
    const m = modes[i];

    const bg1 = i % 2 === 0 ? "0.97 0.98 1" : "1 1 1";
    page3Lines.push(`${bg1} rg 40 ${cpY} 250 16 rectfill`);
    if (s) {
      page3Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 45 ${cpY + 4} Td (${escapePdfText(s.source)}) Tj ET`);
      page3Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 135 ${cpY + 4} Td (${s.leadsGenerated}) Tj ET`);
      page3Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 165 ${cpY + 4} Td (${s.admissions}) Tj ET`);
      page3Lines.push(`BT /F1 7.5 Tf 0.1 0.4 0.2 rg 195 ${cpY + 4} Td (Rs. ${Math.round(s.revenueContribution || 0).toLocaleString("en-IN")}) Tj ET`);
    }

    const bg2 = i % 2 === 0 ? "0.96 0.99 0.96" : "1 1 1";
    page3Lines.push(`${bg2} rg 300 ${cpY} 255 16 rectfill`);
    if (m) {
      page3Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 305 ${cpY + 4} Td (${escapePdfText(m.mode)}) Tj ET`);
      page3Lines.push(`BT /F1 7.5 Tf 0.1 0.4 0.2 rg 405 ${cpY + 4} Td (Rs. ${Math.round(m.amount || 0).toLocaleString("en-IN")}) Tj ET`);
      page3Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 505 ${cpY + 4} Td (${m.percentage}%) Tj ET`);
    }
    cpY -= 16;
  }

  // Section 10: Pending Fee & EMI Summary
  cpY -= 10;
  page3Lines.push(`BT /F2 9.5 Tf 0.1 0.1 0.1 rg 40 ${cpY} Td (10. PENDING FEE & OVERDUE EMI PRIORITY FOLLOW-UP LIST) Tj ET`);
  cpY -= 18;
  page3Lines.push(`0.7 0.2 0.2 rg 40 ${cpY} 515 16 rectfill`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 45 ${cpY + 4} Td (Student Name) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 190 ${cpY + 4} Td (Course) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 310 ${cpY + 4} Td (Mobile Phone) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 420 ${cpY + 4} Td (Overdue Balance) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 490 ${cpY + 4} Td (Due Date) Tj ET`);

  cpY -= 16;
  (pending.studentsRequiringFollowup || []).slice(0, 5).forEach((st, idx) => {
    const bg = idx % 2 === 0 ? "0.99 0.96 0.96" : "1 1 1";
    page3Lines.push(`${bg} rg 40 ${cpY} 515 16 rectfill`);
    page3Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 45 ${cpY + 4} Td (${escapePdfText(st.fullName)}) Tj ET`);
    page3Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 190 ${cpY + 4} Td (${escapePdfText(st.course)}) Tj ET`);
    page3Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 310 ${cpY + 4} Td (${escapePdfText(st.mobileNumber)}) Tj ET`);
    page3Lines.push(`BT /F2 8 Tf 0.7 0.1 0.1 rg 420 ${cpY + 4} Td (Rs. ${Math.round(st.remainingBalance || 0).toLocaleString("en-IN")}) Tj ET`);
    page3Lines.push(`BT /F1 8 Tf 0.3 0.3 0.3 rg 490 ${cpY + 4} Td (${escapePdfText(st.nextDueDate)}) Tj ET`);
    cpY -= 16;
  });

  page3Lines.push(`0.85 0.85 0.85 rg 40 45 515 1 rectfill`);
  page3Lines.push(`BT /F1 8 Tf 0.5 0.5 0.5 rg 40 30 Td (CoachFlow ERP - Executive BI Master Report - Page 3 of 4) Tj ET`);

  // ==========================================
  // PAGE 4: OPERATIONAL ALERTS + PREDICTIVE TARGETS + AI SYNTHESIS
  // ==========================================
  const page4Lines: string[] = [
    `BT /F2 16 Tf 0.12 0.11 0.29 rg 40 805 Td (CoachFlow ERP - Operational Alerts, Targets & AI Insights) Tj ET`,
    `BT /F1 8.5 Tf 0.4 0.4 0.4 rg 40 792 Td (Report Date: ${dateStr}    |    Page 4 of 4) Tj ET`,
    `0.12 0.11 0.29 rg 40 782 515 2 rectfill`,

    // Section 11: Operational Alerts
    `BT /F2 9.5 Tf 0.1 0.1 0.1 rg 40 766 Td (11. AUTOMATED OPERATIONAL ALERTS) Tj ET`,
  ];

  let p4Y = 746;
  alerts.slice(0, 4).forEach((al) => {
    const isCrit = al.type === "critical";
    const bg = isCrit ? "0.99 0.95 0.95" : "0.99 0.98 0.94";
    const border = isCrit ? "0.8 0.2 0.2" : "0.8 0.6 0.2";

    page4Lines.push(`${bg} rg 40 ${p4Y - 25} 515 35 rectfill`);
    page4Lines.push(`${border} rg 40 ${p4Y - 25} 515 35 rectstroke`);
    page4Lines.push(`BT /F2 8.5 Tf 0.1 0.1 0.1 rg 48 ${p4Y - 5} Td ([${escapePdfText(al.category)}] ${escapePdfText(al.title)}) Tj ET`);
    page4Lines.push(`BT /F1 8 Tf 0.3 0.3 0.3 rg 48 ${p4Y - 18} Td (${escapePdfText(al.message)}) Tj ET`);
    p4Y -= 42;
  });

  // Section 12: Tomorrow's Predictive Business Targets with Progress Bar Graphics
  p4Y -= 5;
  page4Lines.push(`BT /F2 9.5 Tf 0.1 0.1 0.1 rg 40 ${p4Y} Td (12. TOMORROW'S PREDICTIVE BUSINESS TARGETS & PROGRESS BARS) Tj ET`);
  p4Y -= 15;
  page4Lines.push(`0.96 0.97 0.99 rg 40 ${p4Y - 50} 515 58 rectfill`);
  page4Lines.push(`0.85 0.85 0.85 rg 40 ${p4Y - 50} 515 58 rectstroke`);

  page4Lines.push(`BT /F2 8 Tf 0.2 0.2 0.7 rg 50 ${p4Y - 15} Td (Revenue Target: Rs. ${Math.round(targets.revenueTarget || 0).toLocaleString("en-IN")}) Tj ET`);
  page4Lines.push(`BT /F2 8 Tf 0.1 0.5 0.2 rg 220 ${p4Y - 15} Td (Collections Target: Rs. ${Math.round(targets.collectionsTarget || 0).toLocaleString("en-IN")}) Tj ET`);
  page4Lines.push(`BT /F2 8 Tf 0.5 0.2 0.7 rg 390 ${p4Y - 15} Td (Admissions Goal: ${targets.admissionsTarget} Students) Tj ET`);

  page4Lines.push(`0.2 0.2 0.7 rg 50 ${p4Y - 24} 120 4 rectfill`);
  page4Lines.push(`0.1 0.5 0.2 rg 220 ${p4Y - 24} 120 4 rectfill`);
  page4Lines.push(`0.5 0.2 0.7 rg 390 ${p4Y - 24} 120 4 rectfill`);

  page4Lines.push(`BT /F2 8 Tf 0.2 0.4 0.8 rg 50 ${p4Y - 38} Td (Lead Followups: ${targets.leadFollowupsTarget} Calls) Tj ET`);
  page4Lines.push(`BT /F2 8 Tf 0.6 0.4 0.1 rg 220 ${p4Y - 38} Td (Demo Sessions: ${targets.demoSessionsTarget} Bookings) Tj ET`);
  page4Lines.push(`BT /F2 8 Tf 0.7 0.2 0.2 rg 390 ${p4Y - 38} Td (EMI Recovery: Rs. ${Math.round(targets.pendingFeeRecoveryTarget || 0).toLocaleString("en-IN")}) Tj ET`);

  page4Lines.push(`0.2 0.4 0.8 rg 50 ${p4Y - 47} 120 4 rectfill`);
  page4Lines.push(`0.6 0.4 0.1 rg 220 ${p4Y - 47} 120 4 rectfill`);
  page4Lines.push(`0.7 0.2 0.2 rg 390 ${p4Y - 47} 120 4 rectfill`);

  p4Y -= 70;

  // Section 13: AI Business Insights Executive Synthesis
  page4Lines.push(`BT /F2 9.5 Tf 0.1 0.1 0.1 rg 40 ${p4Y} Td (13. AI BUSINESS INSIGHTS & STRATEGIC EXECUTIVE SYNTHESIS) Tj ET`);
  p4Y -= 15;
  page4Lines.push(`0.1 0.12 0.18 rg 40 ${p4Y - 210} 515 215 rectfill`);

  page4Lines.push(`BT /F2 9 Tf 0.4 0.8 1 rg 50 ${p4Y - 18} Td (AUTOMATED EXECUTIVE OBSERVATION SUMMARY) Tj ET`);
  page4Lines.push(`BT /F1 8 Tf 0.9 0.9 0.9 rg 50 ${p4Y - 32} Td (${escapePdfText(ai.executiveSummary || "Continuous monitoring active across all academic & financial CRM streams.")}) Tj ET`);

  page4Lines.push(`BT /F2 8.5 Tf 0.4 0.9 0.5 rg 50 ${p4Y - 55} Td (KEY OPERATIONAL ACHIEVEMENTS) Tj ET`);
  let aY = p4Y - 70;
  (ai.keyAchievements || []).slice(0, 3).forEach((ach) => {
    page4Lines.push(`BT /F1 8 Tf 0.9 0.9 0.9 rg 55 ${aY} Td (* ${escapePdfText(ach)}) Tj ET`);
    aY -= 14;
  });

  aY -= 5;
  page4Lines.push(`BT /F2 8.5 Tf 1 0.7 0.3 rg 50 ${aY} Td (RECOMMENDED PRIORITY ACTIONS FOR TOMORROW) Tj ET`);
  aY -= 15;
  (ai.recommendedPriorityActions || []).slice(0, 3).forEach((act) => {
    page4Lines.push(`BT /F1 8 Tf 0.9 0.9 0.9 rg 55 ${aY} Td (* ${escapePdfText(act)}) Tj ET`);
    aY -= 14;
  });

  page4Lines.push(`0.85 0.85 0.85 rg 40 45 515 1 rectfill`);
  page4Lines.push(`BT /F1 8 Tf 0.5 0.5 0.5 rg 40 30 Td (CoachFlow Decision Support Engine v3.2   |   Official Executive Master Report) Tj ET`);
  page4Lines.push(`BT /F1 8 Tf 0.5 0.5 0.5 rg 450 30 Td (Page 4 of 4) Tj ET`);

  const p1Text = page1Lines.join("\n");
  const p2Text = page2Lines.join("\n");
  const p3Text = page3Lines.join("\n");
  const p4Text = page4Lines.join("\n");

  const objects = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R 6 0 R] /Count 4 >>\nendobj`);
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 7 0 R /F2 8 0 R >> >> /Contents 9 0 R >>\nendobj`);
  objects.push(`4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 7 0 R /F2 8 0 R >> >> /Contents 10 0 R >>\nendobj`);
  objects.push(`5 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 7 0 R /F2 8 0 R >> >> /Contents 11 0 R >>\nendobj`);
  objects.push(`6 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 7 0 R /F2 8 0 R >> >> /Contents 12 0 R >>\nendobj`);
  objects.push(`7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
  objects.push(`8 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);
  objects.push(`9 0 obj\n<< /Length ${Buffer.byteLength(p1Text)} >>\nstream\n${p1Text}\nendstream\nendobj`);
  objects.push(`10 0 obj\n<< /Length ${Buffer.byteLength(p2Text)} >>\nstream\n${p2Text}\nendstream\nendobj`);
  objects.push(`11 0 obj\n<< /Length ${Buffer.byteLength(p3Text)} >>\nstream\n${p3Text}\nendstream\nendobj`);
  objects.push(`12 0 obj\n<< /Length ${Buffer.byteLength(p4Text)} >>\nstream\n${p4Text}\nendstream\nendobj`);

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
