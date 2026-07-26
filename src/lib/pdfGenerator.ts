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
    `0.85 0.85 0.85 rg 50 730 495 1 re f`,

    // Left Column Meta Box
    `0.96 0.96 0.96 rg 50 625 240 95 re f`,
    `0.85 0.85 0.85 RG 50 625 240 95 re s`,
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
    `0.85 0.85 0.85 rg 305 700 240 20 re f`,
    `BT /F2 9 Tf 0.2 0.2 0.2 rg 310 706 Td (Received From :) Tj ET`,
    `BT /F2 10 Tf 0.1 0.1 0.1 rg 305 684 Td (${student}) Tj ET`,
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 305 669 Td (Admission Batch : Lucknow) Tj ET`,
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 305 654 Td (Lucknow) Tj ET`,

    // Solid Green Amount Pill
    `0.15 0.68 0.32 rg 305 625 240 22 re f`,
    `BT /F2 12 Tf 1 1 1 rg 400 632 Td (INR ${amountStr}) Tj ET`,

    // Invoice Details Section
    `BT /F2 10 Tf 0.1 0.1 0.1 rg 50 605 Td (Invoice Details) Tj ET`,
    `0.82 0.82 0.82 rg 50 585 495 18 re f`,
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
    `0.82 0.82 0.82 rg 50 525 495 18 re f`,
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
    `0.88 0.88 0.88 rg 50 490 495 16 re f`,
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
    `0.5 0.5 0.5 rg 380 620 150 1 re f`,
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
  // PAGE 1: HEADER + VIBRANT EXECUTIVE KPIs + BRAND REVENUE BAR CHARTS + COMPARISON VISUALS
  // ==========================================
  const page1Lines: string[] = [
    // Header Banner Box
    `0.08 0.12 0.28 rg 30 770 535 55 re f`,
    `BT /F2 15 Tf 1 1 1 rg 45 802 Td (COACHFLOW ERP - EXECUTIVE BUSINESS INTELLIGENCE REPORT) Tj ET`,
    `BT /F1 8.5 Tf 0.85 0.9 0.98 rg 45 786 Td (Report Date: ${dateStr}    |    Generated at: ${genAtStr}) Tj ET`,

    // Section 1: Executive KPI Grid (8 Colorful Cards)
    `BT /F2 10 Tf 0.08 0.12 0.28 rg 40 752 Td (1. EXECUTIVE KEY PERFORMANCE INDICATORS) Tj ET`,
  ];

  // Card Y-positions
  // Row 1 Cards (Y = 676..736)
  // Card 1: Total Revenue (Emerald Green)
  page1Lines.push(`0.92 0.97 0.94 rg 40 680 120 54 re f`);
  page1Lines.push(`0.02 0.59 0.41 RG 40 680 120 54 re s`);
  page1Lines.push(`0.02 0.59 0.41 rg 40 722 120 12 re f`);
  page1Lines.push(`BT /F2 7 Tf 1 1 1 rg 45 725 Td (TOTAL REVENUE) Tj ET`);
  page1Lines.push(`BT /F2 9 Tf 0.05 0.3 0.2 rg 45 706 Td (Rs. ${Math.round(ex.totalRevenue?.value || 0).toLocaleString("en-IN")}) Tj ET`);
  page1Lines.push(`BT /F1 7 Tf 0.1 0.5 0.2 rg 45 690 Td (${formatChange(ex.totalRevenue?.changePct || 0)} vs yest) Tj ET`);

  // Card 2: Total Collections (Royal Blue)
  page1Lines.push(`0.93 0.95 0.99 rg 171 680 120 54 re f`);
  page1Lines.push(`0.14 0.38 0.92 RG 171 680 120 54 re s`);
  page1Lines.push(`0.14 0.38 0.92 rg 171 722 120 12 re f`);
  page1Lines.push(`BT /F2 7 Tf 1 1 1 rg 176 725 Td (TOTAL COLLECTIONS) Tj ET`);
  page1Lines.push(`BT /F2 9 Tf 0.1 0.2 0.6 rg 176 706 Td (Rs. ${Math.round(ex.totalCollections?.value || 0).toLocaleString("en-IN")}) Tj ET`);
  page1Lines.push(`BT /F1 7 Tf 0.1 0.4 0.8 rg 176 690 Td (${formatChange(ex.totalCollections?.changePct || 0)} vs yest) Tj ET`);

  // Card 3: Total Leads (Deep Purple)
  page1Lines.push(`0.96 0.94 0.99 rg 302 680 120 54 re f`);
  page1Lines.push(`0.48 0.22 0.93 RG 302 680 120 54 re s`);
  page1Lines.push(`0.48 0.22 0.93 rg 302 722 120 12 re f`);
  page1Lines.push(`BT /F2 7 Tf 1 1 1 rg 307 725 Td (TOTAL LEADS) Tj ET`);
  page1Lines.push(`BT /F2 10 Tf 0.3 0.1 0.5 rg 307 706 Td (${ex.totalLeads?.value || 0} Enquiries) Tj ET`);
  page1Lines.push(`BT /F1 7 Tf 0.4 0.2 0.8 rg 307 690 Td (${formatChange(ex.totalLeads?.changePct || 0)} vs yest) Tj ET`);

  // Card 4: Admissions (Teal/Cyan)
  page1Lines.push(`0.92 0.97 0.98 rg 433 680 122 54 re f`);
  page1Lines.push(`0.02 0.52 0.78 RG 433 680 122 54 re s`);
  page1Lines.push(`0.02 0.52 0.78 rg 433 722 122 12 re f`);
  page1Lines.push(`BT /F2 7 Tf 1 1 1 rg 438 725 Td (ADMISSIONS) Tj ET`);
  page1Lines.push(`BT /F2 10 Tf 0.01 0.3 0.5 rg 438 706 Td (${ex.admissions?.value || 0} Confirmed) Tj ET`);
  page1Lines.push(`BT /F1 7 Tf 0.02 0.4 0.6 rg 438 690 Td (${formatChange(ex.admissions?.changePct || 0)} vs yest) Tj ET`);

  // Row 2 Cards (Y = 616..670)
  // Card 5: Conversion Rate (Amber)
  page1Lines.push(`0.99 0.96 0.92 rg 40 616 120 54 re f`);
  page1Lines.push(`0.85 0.45 0.05 RG 40 616 120 54 re s`);
  page1Lines.push(`0.85 0.45 0.05 rg 40 658 120 12 re f`);
  page1Lines.push(`BT /F2 7 Tf 1 1 1 rg 45 661 Td (CONVERSION RATE) Tj ET`);
  page1Lines.push(`BT /F2 10 Tf 0.6 0.3 0.01 rg 45 642 Td (${ex.conversionRate?.value || 0}%) Tj ET`);
  page1Lines.push(`BT /F1 7 Tf 0.5 0.3 0.1 rg 45 626 Td (Target: >15%) Tj ET`);

  // Card 6: Outstanding Fees (Slate)
  page1Lines.push(`0.95 0.96 0.98 rg 171 616 120 54 re f`);
  page1Lines.push(`0.3 0.35 0.45 RG 171 616 120 54 re s`);
  page1Lines.push(`0.3 0.35 0.45 rg 171 658 120 12 re f`);
  page1Lines.push(`BT /F2 7 Tf 1 1 1 rg 176 661 Td (OUTSTANDING FEES) Tj ET`);
  page1Lines.push(`BT /F2 9 Tf 0.2 0.2 0.3 rg 176 642 Td (Rs. ${Math.round(ex.outstandingFees?.value || 0).toLocaleString("en-IN")}) Tj ET`);
  page1Lines.push(`BT /F1 7 Tf 0.3 0.3 0.4 rg 176 626 Td (Pending Recovery) Tj ET`);

  // Card 7: Estimated Loss (Crimson Red)
  page1Lines.push(`0.99 0.93 0.93 rg 302 616 120 54 re f`);
  page1Lines.push(`0.82 0.15 0.15 RG 302 616 120 54 re s`);
  page1Lines.push(`0.82 0.15 0.15 rg 302 658 120 12 re f`);
  page1Lines.push(`BT /F2 7 Tf 1 1 1 rg 307 661 Td (ESTIMATED LOSS) Tj ET`);
  page1Lines.push(`BT /F2 9 Tf 0.7 0.1 0.1 rg 307 642 Td (Rs. ${Math.round(ex.businessLoss?.value || 0).toLocaleString("en-IN")}) Tj ET`);
  page1Lines.push(`BT /F1 7 Tf 0.6 0.1 0.1 rg 307 626 Td (Unconverted Opp.) Tj ET`);

  // Card 8: Unconverted Leads (Purple Magenta)
  page1Lines.push(`0.97 0.93 0.97 rg 433 616 122 54 re f`);
  page1Lines.push(`0.7 0.15 0.55 RG 433 616 122 54 re s`);
  page1Lines.push(`0.7 0.15 0.55 rg 433 658 122 12 re f`);
  page1Lines.push(`BT /F2 7 Tf 1 1 1 rg 438 661 Td (UNCONVERTED) Tj ET`);
  page1Lines.push(`BT /F2 10 Tf 0.5 0.1 0.4 rg 438 642 Td (${loss.unconvertedLeads || 0} Leads) Tj ET`);
  page1Lines.push(`BT /F1 7 Tf 0.5 0.1 0.4 rg 438 626 Td (Priority Followup) Tj ET`);

  // Section 2 (REPLACING 14-DAY TABLE): VISUAL BRAND REVENUE GRAPHICAL BARS
  let p1Y = 590;
  page1Lines.push(`BT /F2 10 Tf 0.08 0.12 0.28 rg 40 ${p1Y} Td (2. BRAND REVENUE DISTRIBUTION & PERFORMANCE VISUAL CHARTS) Tj ET`);
  p1Y -= 15;

  const topBrands = brands.slice(0, 6);
  const maxBrandVal = Math.max(...topBrands.map((b) => b.dailyCollections || 0), 1);
  const barColors = [
    "0.02 0.59 0.41", // Emerald
    "0.14 0.38 0.92", // Royal Blue
    "0.48 0.22 0.93", // Purple
    "0.85 0.45 0.05", // Amber
    "0.02 0.52 0.78", // Cyan
    "0.7 0.15 0.55",  // Magenta
  ];

  topBrands.forEach((b, idx) => {
    const col = barColors[idx % barColors.length];
    const bw = Math.max(15, Math.min(260, ((b.dailyCollections || 0) / maxBrandVal) * 260));

    page1Lines.push(`0.97 0.98 0.99 rg 40 ${p1Y - 14} 515 22 re f`);
    page1Lines.push(`BT /F2 8 Tf 0.1 0.1 0.2 rg 45 ${p1Y - 2} Td (${escapePdfText(b.brandName)}) Tj ET`);

    // Draw visual graphical bar
    page1Lines.push(`${col} rg 180 ${p1Y - 10} ${bw} 12 re f`);
    page1Lines.push(`BT /F2 8 Tf 0.1 0.5 0.2 rg ${190 + bw} ${p1Y - 2} Td (Rs. ${Math.round(b.dailyCollections || 0).toLocaleString("en-IN")}  (${b.admissions} Adm)) Tj ET`);

    p1Y -= 25;
  });

  // Section 3: REVENUE COMPARISON BENCHMARK BAR CHART
  p1Y -= 10;
  page1Lines.push(`BT /F2 10 Tf 0.08 0.12 0.28 rg 40 ${p1Y} Td (3. REVENUE BENCHMARK COMPARISON GRAPH) Tj ET`);
  p1Y -= 15;
  page1Lines.push(`0.96 0.97 0.99 rg 40 ${p1Y - 60} 515 65 re f`);
  page1Lines.push(`0.85 0.85 0.85 rg 40 ${p1Y - 60} 515 65 re s`);

  const maxComp = Math.max(comp.today || 0, comp.yesterday || 0, comp.sameDayLastWeek || 0, 1);
  const w1 = Math.max(12, Math.min(320, ((comp.today || 0) / maxComp) * 320));
  const w2 = Math.max(12, Math.min(320, ((comp.yesterday || 0) / maxComp) * 320));
  const w3 = Math.max(12, Math.min(320, ((comp.sameDayLastWeek || 0) / maxComp) * 320));

  // Today Bar
  page1Lines.push(`BT /F2 8 Tf 0.14 0.38 0.92 rg 50 ${p1Y - 14} Td (Today's Revenue:) Tj ET`);
  page1Lines.push(`0.14 0.38 0.92 rg 170 ${p1Y - 16} ${w1} 10 re f`);
  page1Lines.push(`BT /F2 8 Tf 0.1 0.1 0.1 rg ${180 + w1} ${p1Y - 14} Td (Rs. ${Math.round(comp.today || 0).toLocaleString("en-IN")}) Tj ET`);

  // Yesterday Bar
  page1Lines.push(`BT /F2 8 Tf 0.48 0.22 0.93 rg 50 ${p1Y - 32} Td (Yesterday's Revenue:) Tj ET`);
  page1Lines.push(`0.48 0.22 0.93 rg 170 ${p1Y - 34} ${w2} 10 re f`);
  page1Lines.push(`BT /F2 8 Tf 0.1 0.1 0.1 rg ${180 + w2} ${p1Y - 32} Td (Rs. ${Math.round(comp.yesterday || 0).toLocaleString("en-IN")}) Tj ET`);

  // Same Day Last Week Bar
  page1Lines.push(`BT /F2 8 Tf 0.3 0.35 0.45 rg 50 ${p1Y - 50} Td (Same Day Last Wk:) Tj ET`);
  page1Lines.push(`0.3 0.35 0.45 rg 170 ${p1Y - 52} ${w3} 10 re f`);
  page1Lines.push(`BT /F2 8 Tf 0.1 0.1 0.1 rg ${180 + w3} ${p1Y - 50} Td (Rs. ${Math.round(comp.sameDayLastWeek || 0).toLocaleString("en-IN")}) Tj ET`);

  page1Lines.push(`0.85 0.85 0.85 rg 40 45 515 1 re f`);
  page1Lines.push(`BT /F1 8 Tf 0.5 0.5 0.5 rg 40 30 Td (CoachFlow ERP - Executive BI Master Report - Page 1 of 4) Tj ET`);

  // ==========================================
  // PAGE 2: CONVERSION FUNNEL + BUSINESS LOSS FORMULA + BRAND PERFORMANCE GRAPH CARDS
  // ==========================================
  const page2Lines: string[] = [
    `0.08 0.12 0.28 rg 30 770 535 55 re f`,
    `BT /F2 15 Tf 1 1 1 rg 45 802 Td (COACHFLOW ERP - CONVERSION FUNNEL & BRAND PERFORMANCE) Tj ET`,
    `BT /F1 8.5 Tf 0.85 0.9 0.98 rg 45 786 Td (Report Date: ${dateStr}    |    Page 2 of 4) Tj ET`,

    // Section 4: Lead Conversion Funnel Diagram Visuals
    `BT /F2 10 Tf 0.08 0.12 0.28 rg 40 752 Td (4. LEAD CONVERSION FUNNEL & VISUAL STAGE DIAGRAM) Tj ET`,
    `0.98 0.98 0.98 rg 40 650 515 92 re f`,
    `0.85 0.85 0.85 RG 40 650 515 92 re s`,

    // Funnel Stage 1
    `0.28 0.35 0.92 rg 50 722 450 12 re f`,
    `BT /F2 8 Tf 1 1 1 rg 55 724 Td (1. Leads Received: ${funnel.leadsReceived}  |  Drop-off to Followup: ${funnel.dropOffRates?.postLeadDropOff || 0}%) Tj ET`,

    // Funnel Stage 2
    `0.02 0.52 0.78 rg 50 698 ${Math.max(30, Math.min(450, ((funnel.stagePercentages?.followupPct || 0) / 100) * 450))} 12 re f`,
    `BT /F2 8 Tf 1 1 1 rg 55 700 Td (2. Followups Completed: ${funnel.followupsCompleted} (${funnel.stagePercentages?.followupPct || 0}%)  |  Drop-off to Demo: ${funnel.dropOffRates?.postFollowupDropOff || 0}%) Tj ET`,

    // Funnel Stage 3
    `0.55 0.25 0.85 rg 50 674 ${Math.max(30, Math.min(450, ((funnel.stagePercentages?.demoPct || 0) / 100) * 450))} 12 re f`,
    `BT /F2 8 Tf 1 1 1 rg 55 676 Td (3. Demos Scheduled: ${funnel.demosScheduled} (${funnel.stagePercentages?.demoPct || 0}%)  |  Drop-off to Admission: ${funnel.dropOffRates?.postDemoDropOff || 0}%) Tj ET`,

    // Funnel Stage 4
    `0.02 0.59 0.41 rg 50 652 ${Math.max(30, Math.min(450, ((funnel.stagePercentages?.admissionPct || 0) / 100) * 450))} 12 re f`,
    `BT /F2 8 Tf 1 1 1 rg 55 654 Td (4. Admissions Confirmed: ${funnel.admissionsConfirmed} (Final Conversion: ${funnel.stagePercentages?.admissionPct || 0}%)) Tj ET`,

    // Section 5: Business Loss Analysis
    `BT /F2 10 Tf 0.08 0.12 0.28 rg 40 630 Td (5. UNREALIZED REVENUE & DEDICATED BUSINESS LOSS ANALYSIS) Tj ET`,
    `0.99 0.94 0.94 rg 40 562 515 58 re f`,
    `0.9 0.7 0.7 RG 40 562 515 58 re s`,
    `BT /F1 8.5 Tf 0.7 0.2 0.2 rg 50 604 Td (Business Loss Formula: (${loss.totalLeads} Total Leads - ${loss.totalAdmissions} Admissions) x Avg Value Rs. ${Math.round(loss.avgAdmissionValue || 0).toLocaleString("en-IN")}) Tj ET`,
    `BT /F2 11 Tf 0.8 0.1 0.1 rg 50 586 Td (Estimated Business Loss = Rs. ${Math.round(loss.estimatedBusinessLoss || 0).toLocaleString("en-IN")}) Tj ET`,
    `BT /F1 8 Tf 0.3 0.3 0.3 rg 50 570 Td (Potential Revenue: Rs. ${Math.round(loss.potentialRevenue || 0).toLocaleString("en-IN")}   |   Actual: Rs. ${Math.round(loss.actualRevenue || 0).toLocaleString("en-IN")}   |   Lost Opp: ${loss.lostOpportunityPct || 0}%) Tj ET`,

    // Section 6: Brand Performance Table
    `BT /F2 10 Tf 0.08 0.12 0.28 rg 40 544 Td (6. BRAND PERFORMANCE BREAKDOWN & COLLECTION METRICS) Tj ET`,
    `0.12 0.18 0.38 rg 40 522 515 18 re f`,
    `BT /F2 8 Tf 1 1 1 rg 45 527 Td (Brand Name) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 170 527 Td (Total Leads) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 230 527 Td (Admissions) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 290 527 Td (Daily Collections (INR)) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 405 527 Td (Conv %) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 460 527 Td (Business Loss) Tj ET`,
  ];

  let bpY = 506;
  brands.slice(0, 12).forEach((b, idx) => {
    const bg = idx % 2 === 0 ? "0.96 0.97 0.99" : "1 1 1";
    page2Lines.push(`${bg} rg 40 ${bpY} 515 15 re f`);
    page2Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 45 ${bpY + 3} Td (${escapePdfText(b.brandName)}) Tj ET`);
    page2Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 170 ${bpY + 3} Td (${b.totalLeads}) Tj ET`);
    page2Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 230 ${bpY + 3} Td (${b.admissions}) Tj ET`);
    page2Lines.push(`BT /F2 8 Tf 0.1 0.5 0.2 rg 290 ${bpY + 3} Td (Rs. ${Math.round(b.dailyCollections || 0).toLocaleString("en-IN")}) Tj ET`);

    page2Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 405 ${bpY + 3} Td (${b.conversionRate}%) Tj ET`);
    page2Lines.push(`BT /F1 8 Tf 0.7 0.2 0.2 rg 460 ${bpY + 3} Td (Rs. ${Math.round(b.estimatedBusinessLoss || 0).toLocaleString("en-IN")}) Tj ET`);
    bpY -= 15;
  });

  page2Lines.push(`0.85 0.85 0.85 rg 40 45 515 1 re f`);
  page2Lines.push(`BT /F1 8 Tf 0.5 0.5 0.5 rg 40 30 Td (CoachFlow ERP - Executive BI Master Report - Page 2 of 4) Tj ET`);

  // ==========================================
  // PAGE 3: COUNSELLORS + LEAD SOURCES + PAYMENT MODES + OVERDUE EMIS
  // ==========================================
  const page3Lines: string[] = [
    `0.08 0.12 0.28 rg 30 770 535 55 re f`,
    `BT /F2 15 Tf 1 1 1 rg 45 802 Td (COACHFLOW ERP - SALES EXECUTIVE & FINANCIAL BREAKDOWN) Tj ET`,
    `BT /F1 8.5 Tf 0.85 0.9 0.98 rg 45 786 Td (Report Date: ${dateStr}    |    Page 3 of 4) Tj ET`,

    // Section 7: Counsellor Performance Dashboard Table
    `BT /F2 10 Tf 0.08 0.12 0.28 rg 40 752 Td (7. COUNSELLOR / SALES EXECUTIVE PERFORMANCE DASHBOARD) Tj ET`,
    `0.48 0.22 0.93 rg 40 730 515 18 re f`,
    `BT /F2 8 Tf 1 1 1 rg 45 735 Td (Sales Executive Name) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 180 735 Td (Scope) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 240 735 Td (Leads) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 285 735 Td (Admissions) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 345 735 Td (Conv %) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 395 735 Td (Collections) Tj ET`,
    `BT /F2 8 Tf 1 1 1 rg 475 735 Td (Performance) Tj ET`,
  ];

  let cpY = 714;

  counsellors.slice(0, 10).forEach((cs, idx) => {
    const bg = idx % 2 === 0 ? "0.98 0.97 0.99" : "1 1 1";
    page3Lines.push(`${bg} rg 40 ${cpY} 515 15 re f`);
    page3Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 45 ${cpY + 3} Td (${escapePdfText(cs.name)}) Tj ET`);
    page3Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 180 ${cpY + 3} Td (${escapePdfText(cs.brandScope)}) Tj ET`);
    page3Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 240 ${cpY + 3} Td (${cs.leadsAssigned}) Tj ET`);
    page3Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 285 ${cpY + 3} Td (${cs.admissionsConverted}) Tj ET`);
    page3Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 345 ${cpY + 3} Td (${cs.conversionPct}%) Tj ET`);
    page3Lines.push(`BT /F2 8 Tf 0.1 0.5 0.2 rg 395 ${cpY + 3} Td (Rs. ${Math.round(cs.collectionsGenerated || 0).toLocaleString("en-IN")}) Tj ET`);

    const tag = cs.isTopPerformer ? "Top Performer" : cs.isLowPerformer ? "Low Velocity" : "Active";
    page3Lines.push(`BT /F1 7.5 Tf 0.3 0.3 0.3 rg 475 ${cpY + 3} Td (${tag}) Tj ET`);
    cpY -= 15;
  });

  // Section 8 & 9: Lead Source Analysis & Collection Summary by Mode
  cpY -= 10;
  page3Lines.push(`BT /F2 10 Tf 0.08 0.12 0.28 rg 40 ${cpY} Td (8. LEAD SOURCE ANALYSIS (MARKETING ROI) & PAYMENT MODES) Tj ET`);
  cpY -= 18;

  page3Lines.push(`0.2 0.5 0.8 rg 40 ${cpY} 250 18 re f`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 45 ${cpY + 5} Td (Lead Source Channel) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 135 ${cpY + 5} Td (Leads) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 165 ${cpY + 5} Td (Adm) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 195 ${cpY + 5} Td (Revenue (INR)) Tj ET`);

  page3Lines.push(`0.1 0.6 0.3 rg 300 ${cpY} 255 18 re f`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 305 ${cpY + 5} Td (Payment Mode) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 405 ${cpY + 5} Td (Amount Received) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 505 ${cpY + 5} Td (Share %) Tj ET`);

  cpY -= 16;
  const maxRows = Math.max(sources.length, modes.length, 4);

  for (let i = 0; i < Math.min(maxRows, 5); i++) {
    const s = sources[i];
    const m = modes[i];

    const bg1 = i % 2 === 0 ? "0.97 0.98 1" : "1 1 1";
    page3Lines.push(`${bg1} rg 40 ${cpY} 250 15 re f`);
    if (s) {
      page3Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 45 ${cpY + 3} Td (${escapePdfText(s.source)}) Tj ET`);
      page3Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 135 ${cpY + 3} Td (${s.leadsGenerated}) Tj ET`);
      page3Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 165 ${cpY + 3} Td (${s.admissions}) Tj ET`);
      page3Lines.push(`BT /F1 7.5 Tf 0.1 0.4 0.2 rg 195 ${cpY + 3} Td (Rs. ${Math.round(s.revenueContribution || 0).toLocaleString("en-IN")}) Tj ET`);
    }

    const bg2 = i % 2 === 0 ? "0.96 0.99 0.96" : "1 1 1";
    page3Lines.push(`${bg2} rg 300 ${cpY} 255 15 re f`);
    if (m) {
      page3Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 305 ${cpY + 3} Td (${escapePdfText(m.mode)}) Tj ET`);
      page3Lines.push(`BT /F1 7.5 Tf 0.1 0.4 0.2 rg 405 ${cpY + 3} Td (Rs. ${Math.round(m.amount || 0).toLocaleString("en-IN")}) Tj ET`);
      page3Lines.push(`BT /F1 7.5 Tf 0.2 0.2 0.2 rg 505 ${cpY + 3} Td (${m.percentage}%) Tj ET`);
    }
    cpY -= 15;
  }

  // Section 10: Pending Fee & EMI Summary
  cpY -= 10;
  page3Lines.push(`BT /F2 10 Tf 0.08 0.12 0.28 rg 40 ${cpY} Td (10. PENDING FEE & OVERDUE EMI PRIORITY FOLLOW-UP LIST) Tj ET`);
  cpY -= 18;
  page3Lines.push(`0.7 0.2 0.2 rg 40 ${cpY} 515 18 re f`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 45 ${cpY + 5} Td (Student Name) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 190 ${cpY + 5} Td (Course) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 310 ${cpY + 5} Td (Mobile Phone) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 420 ${cpY + 5} Td (Overdue Balance) Tj ET`);
  page3Lines.push(`BT /F2 8 Tf 1 1 1 rg 490 ${cpY + 5} Td (Due Date) Tj ET`);

  cpY -= 16;
  (pending.studentsRequiringFollowup || []).slice(0, 5).forEach((st, idx) => {
    const bg = idx % 2 === 0 ? "0.99 0.96 0.96" : "1 1 1";
    page3Lines.push(`${bg} rg 40 ${cpY} 515 15 re f`);
    page3Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 45 ${cpY + 3} Td (${escapePdfText(st.fullName)}) Tj ET`);
    page3Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 190 ${cpY + 3} Td (${escapePdfText(st.course)}) Tj ET`);
    page3Lines.push(`BT /F1 8 Tf 0.2 0.2 0.2 rg 310 ${cpY + 3} Td (${escapePdfText(st.mobileNumber)}) Tj ET`);
    page3Lines.push(`BT /F2 8 Tf 0.7 0.1 0.1 rg 420 ${cpY + 3} Td (Rs. ${Math.round(st.remainingBalance || 0).toLocaleString("en-IN")}) Tj ET`);
    page3Lines.push(`BT /F1 8 Tf 0.3 0.3 0.3 rg 490 ${cpY + 3} Td (${escapePdfText(st.nextDueDate)}) Tj ET`);
    cpY -= 15;
  });

  page3Lines.push(`0.85 0.85 0.85 rg 40 45 515 1 re f`);
  page3Lines.push(`BT /F1 8 Tf 0.5 0.5 0.5 rg 40 30 Td (CoachFlow ERP - Executive BI Master Report - Page 3 of 4) Tj ET`);

  // ==========================================
  // PAGE 4: OPERATIONAL ALERTS + PREDICTIVE TARGETS + AI SYNTHESIS
  // ==========================================
  const page4Lines: string[] = [
    `0.08 0.12 0.28 rg 30 770 535 55 re f`,
    `BT /F2 15 Tf 1 1 1 rg 45 802 Td (COACHFLOW ERP - OPERATIONAL ALERTS, TARGETS & AI INSIGHTS) Tj ET`,
    `BT /F1 8.5 Tf 0.85 0.9 0.98 rg 45 786 Td (Report Date: ${dateStr}    |    Page 4 of 4) Tj ET`,

    // Section 11: Operational Alerts
    `BT /F2 10 Tf 0.08 0.12 0.28 rg 40 752 Td (11. AUTOMATED OPERATIONAL ALERTS) Tj ET`,
  ];

  let p4Y = 732;
  alerts.slice(0, 4).forEach((al) => {
    const isCrit = al.type === "critical";
    const bg = isCrit ? "0.99 0.95 0.95" : "0.99 0.98 0.94";
    const border = isCrit ? "0.8 0.2 0.2" : "0.8 0.6 0.2";

    page4Lines.push(`${bg} rg 40 ${p4Y - 25} 515 35 re f`);
    page4Lines.push(`${border} rg 40 ${p4Y - 25} 515 35 re s`);
    page4Lines.push(`BT /F2 8.5 Tf 0.1 0.1 0.1 rg 48 ${p4Y - 5} Td ([${escapePdfText(al.category)}] ${escapePdfText(al.title)}) Tj ET`);
    page4Lines.push(`BT /F1 8 Tf 0.3 0.3 0.3 rg 48 ${p4Y - 18} Td (${escapePdfText(al.message)}) Tj ET`);
    p4Y -= 40;
  });

  // Section 12: Tomorrow's Predictive Business Targets with Visual Progress Bars
  p4Y -= 5;
  page4Lines.push(`BT /F2 10 Tf 0.08 0.12 0.28 rg 40 ${p4Y} Td (12. TOMORROW'S PREDICTIVE TARGETS & VISUAL PROGRESS BARS) Tj ET`);
  p4Y -= 15;
  page4Lines.push(`0.96 0.97 0.99 rg 40 ${p4Y - 50} 515 58 re f`);
  page4Lines.push(`0.85 0.85 0.85 rg 40 ${p4Y - 50} 515 58 re s`);

  page4Lines.push(`BT /F2 8 Tf 0.2 0.2 0.7 rg 50 ${p4Y - 15} Td (Revenue Target: Rs. ${Math.round(targets.revenueTarget || 0).toLocaleString("en-IN")}) Tj ET`);
  page4Lines.push(`BT /F2 8 Tf 0.1 0.5 0.2 rg 220 ${p4Y - 15} Td (Collections Target: Rs. ${Math.round(targets.collectionsTarget || 0).toLocaleString("en-IN")}) Tj ET`);
  page4Lines.push(`BT /F2 8 Tf 0.5 0.2 0.7 rg 390 ${p4Y - 15} Td (Admissions Goal: ${targets.admissionsTarget} Students) Tj ET`);

  page4Lines.push(`0.2 0.2 0.7 rg 50 ${p4Y - 24} 120 4 re f`);
  page4Lines.push(`0.1 0.5 0.2 rg 220 ${p4Y - 24} 120 4 re f`);
  page4Lines.push(`0.5 0.2 0.7 rg 390 ${p4Y - 24} 120 4 re f`);

  page4Lines.push(`BT /F2 8 Tf 0.2 0.4 0.8 rg 50 ${p4Y - 38} Td (Lead Followups: ${targets.leadFollowupsTarget} Calls) Tj ET`);
  page4Lines.push(`BT /F2 8 Tf 0.6 0.4 0.1 rg 220 ${p4Y - 38} Td (Demo Sessions: ${targets.demoSessionsTarget} Bookings) Tj ET`);
  page4Lines.push(`BT /F2 8 Tf 0.7 0.2 0.2 rg 390 ${p4Y - 38} Td (EMI Recovery: Rs. ${Math.round(targets.pendingFeeRecoveryTarget || 0).toLocaleString("en-IN")}) Tj ET`);

  page4Lines.push(`0.2 0.4 0.8 rg 50 ${p4Y - 47} 120 4 re f`);
  page4Lines.push(`0.6 0.4 0.1 rg 220 ${p4Y - 47} 120 4 re f`);
  page4Lines.push(`0.7 0.2 0.2 rg 390 ${p4Y - 47} 120 4 re f`);

  p4Y -= 68;

  // Section 13: AI Business Insights Executive Synthesis Dark Card
  page4Lines.push(`BT /F2 10 Tf 0.08 0.12 0.28 rg 40 ${p4Y} Td (13. AI BUSINESS INSIGHTS & STRATEGIC EXECUTIVE SYNTHESIS) Tj ET`);
  p4Y -= 15;
  page4Lines.push(`0.06 0.09 0.16 rg 40 ${p4Y - 210} 515 210 re f`);

  page4Lines.push(`BT /F2 9.5 Tf 0.34 0.8 0.95 rg 52 ${p4Y - 18} Td (AUTOMATED EXECUTIVE OBSERVATION SUMMARY) Tj ET`);
  page4Lines.push(`BT /F1 8 Tf 1 1 1 rg 52 ${p4Y - 32} Td (${escapePdfText(ai.executiveSummary || "Continuous monitoring active across all academic & financial CRM streams.")}) Tj ET`);

  page4Lines.push(`BT /F2 9 Tf 0.4 0.9 0.5 rg 52 ${p4Y - 55} Td (KEY OPERATIONAL ACHIEVEMENTS) Tj ET`);
  let aY = p4Y - 70;
  (ai.keyAchievements || []).slice(0, 3).forEach((ach) => {
    page4Lines.push(`BT /F1 8 Tf 1 1 1 rg 58 ${aY} Td (* ${escapePdfText(ach)}) Tj ET`);
    aY -= 14;
  });

  aY -= 4;
  page4Lines.push(`BT /F2 9 Tf 1 0.7 0.3 rg 52 ${aY} Td (RECOMMENDED PRIORITY ACTIONS FOR TOMORROW) Tj ET`);
  aY -= 14;
  (ai.recommendedPriorityActions || []).slice(0, 3).forEach((act) => {
    page4Lines.push(`BT /F1 8 Tf 1 1 1 rg 58 ${aY} Td (* ${escapePdfText(act)}) Tj ET`);
    aY -= 14;
  });

  page4Lines.push(`0.85 0.85 0.85 rg 40 45 515 1 re f`);
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
