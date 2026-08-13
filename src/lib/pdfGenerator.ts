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
  companyAddress?: string;
  totalFee?: number | string;
  totalPaidToDate?: number | string;
  remainingBalance?: number | string;
  downpaymentAmount?: number | string;
  downpaymentDueDate?: string | Date;
  customEmiPlan?: any[];
  generatedAtStr?: string;
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
  const company = (data.companyName || "INSTITUTE OF CREATIVE STUDIES").replace(/[()]/g, "");
  const companyAddress = (data.companyAddress || "No listed street, No City, No State, PIN").replace(/[()]/g, "");
  const mode = (data.paymentMode || "Online").replace(/[()]/g, "");
  const ref = (data.referenceNo || "N/A").replace(/[()]/g, "");
  const receiptNo = (data.receiptNo || "CM/CTE/2024/1230").replace(/[()]/g, "");
  const payDate = (data.paymentDate || new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })).replace(/[()]/g, "");
  const generatedTime = (data.generatedAtStr || new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })).replace(/[()]/g, "");

  const amountVal = Number(data.amountPaid || 0);
  const amountStr = amountVal.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  
  const finalFeeVal = Number(data.totalFee || amountVal);
  const totalPaidVal = Number(data.totalPaidToDate || amountVal);
  const remainingVal = Number(data.remainingBalance || 0);

  // Dynamic Brand Initials (e.g. DESIGN GATEWAY -> DG, CADD MANTRA -> CM)
  const brandInitials = brand
    .split(/\s+/)
    .map((w: string) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 3) || "CM";

  // Format short date for table cells to avoid overlapping (e.g., "01 Aug 2026")
  const shortPayDate = payDate.includes(",") ? payDate.split(",")[0].trim() : payDate;

  // --- PAGE 1 CONTENT STREAM ---
  const page1Lines = [
    // Header Left Logo + Company Details
    `BT /F2 18 Tf 0.72 0.11 0.11 rg 50 765 Td (${brandInitials}) Tj ET`,
    `BT /F2 8 Tf 0.1 0.1 0.1 rg 50 750 Td (${brand.slice(0, 15)}) Tj ET`,

    `BT /F2 11 Tf 0.1 0.1 0.1 rg 115 778 Td (${company}) Tj ET`,
    `BT /F1 7.5 Tf 0.3 0.3 0.3 rg 115 766 Td (Company Addr: ${companyAddress}) Tj ET`,
    `BT /F2 8 Tf 0.1 0.5 0.2 rg 115 754 Td (Brand: ${brand} | Addr: ${brandAddress}) Tj ET`,

    // Header Right
    `BT /F2 9.5 Tf 0.1 0.6 0.2 rg 360 780 Td (Receipt # ${receiptNo}) Tj ET`,
    `BT /F1 7 Tf 0.4 0.4 0.4 rg 360 768 Td (Generated: ${generatedTime}) Tj ET`,
    
    // Barcode Vector Graphic
    `0.1 0.1 0.1 rg`,
    `360 742 180 20 re f`,
    `1 1 1 rg`,
    `365 742 3 20 re f`, `372 742 2 20 re f`, `378 742 4 20 re f`,
    `386 742 2 20 re f`, `392 742 5 20 re f`, `402 742 3 20 re f`,
    `410 742 2 20 re f`, `416 742 4 20 re f`, `425 742 3 20 re f`,
    `433 742 5 20 re f`, `442 742 2 20 re f`, `450 742 4 20 re f`,
    `460 742 3 20 re f`, `470 742 2 20 re f`, `480 742 5 20 re f`,

    // Top Divider Line
    fillRoundedRect("0.85 0.85 0.85", 50, 730, 495, 1, 4),

    // Left Column Meta Box
    fillRoundedRect("0.96 0.96 0.96", 50, 625, 240, 95, 4),
    strokeRoundedRect("0.85 0.85 0.85", 50, 625, 240, 95, 4),
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 55 707 Td (Receipt #) Tj ET`,
    `BT /F2 8.5 Tf 0.1 0.1 0.1 rg 160 707 Td (${receiptNo}) Tj ET`,
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 55 688 Td (Receipt Date & Time) Tj ET`,
    `BT /F1 8.5 Tf 0.1 0.1 0.1 rg 160 688 Td (${payDate}) Tj ET`,
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 55 669 Td (Received In) Tj ET`,
    `BT /F1 8.5 Tf 0.1 0.1 0.1 rg 160 669 Td (${mode}) Tj ET`,
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 55 650 Td (Cheque/Tran. Number) Tj ET`,
    `BT /F1 8.5 Tf 0.1 0.1 0.1 rg 160 650 Td (${ref}) Tj ET`,
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 55 631 Td (Received Fee) Tj ET`,
    `BT /F2 8.5 Tf 0.1 0.1 0.1 rg 160 631 Td (${amountStr}) Tj ET`,

    // Right Column Received From & Green Pill
    fillRoundedRect("0.85 0.85 0.85", 305, 700, 240, 20, 4),
    `BT /F2 9 Tf 0.2 0.2 0.2 rg 310 706 Td (Received From :) Tj ET`,
    `BT /F2 10 Tf 0.1 0.1 0.1 rg 305 684 Td (${student}) Tj ET`,
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 305 669 Td (Admission Batch : Lucknow) Tj ET`,
    `BT /F1 8.5 Tf 0.3 0.3 0.3 rg 305 654 Td (Lucknow) Tj ET`,

    // Solid Green Amount Pill
    fillRoundedRect("0.15 0.68 0.32", 305, 625, 240, 22, 4),
    `BT /F2 12 Tf 1 1 1 rg 380 632 Td (INR ${amountStr}) Tj ET`,

    // Invoice Details Section
    `BT /F2 10 Tf 0.1 0.1 0.1 rg 50 605 Td (Invoice Details) Tj ET`,
    fillRoundedRect("0.82 0.82 0.82", 50, 585, 495, 18, 4),
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 55 590 Td (Received against Invoice #) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 160 590 Td (Package Details) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 290 590 Td (Fees Details) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 360 590 Td (Invoice Date) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 435 590 Td (Due Fee) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 490 590 Td (Received Fee) Tj ET`,

    `BT /F1 8 Tf 0.2 0.2 0.2 rg 55 570 Td (566) Tj ET`,
    `BT /F1 8 Tf 0.2 0.2 0.2 rg 160 570 Td (${course.slice(0, 22)}) Tj ET`,
    `BT /F1 8 Tf 0.2 0.2 0.2 rg 290 570 Td (Course Fees) Tj ET`,
    `BT /F1 8 Tf 0.2 0.2 0.2 rg 360 570 Td (${shortPayDate}) Tj ET`,
    `BT /F1 8 Tf 0.2 0.2 0.2 rg 435 570 Td (${amountVal}) Tj ET`,
    `BT /F2 8 Tf 0.1 0.5 0.2 rg 490 570 Td (${amountVal}) Tj ET`,

    // Installment Payments Section
    `BT /F2 10 Tf 0.1 0.1 0.1 rg 50 545 Td (Installment & Downpayment Payments Schedule) Tj ET`,
    fillRoundedRect("0.82 0.82 0.82", 50, 525, 495, 18, 4),
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 55 530 Td (Due Date) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 125 530 Td (Invoice / Item) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 185 530 Td (Due Fee) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 235 530 Td (Received Fee) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 295 530 Td (Balance Fee) Tj ET`,
    `BT /F2 8 Tf 0.2 0.2 0.2 rg 365 530 Td (Payment Details) Tj ET`,

    ...(Number(data.downpaymentAmount || 0) > 0 ? [
      `BT /F1 8 Tf 0.2 0.2 0.2 rg 55 510 Td (${data.downpaymentDueDate ? new Date(data.downpaymentDueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : shortPayDate}) Tj ET`,
      `BT /F1 8 Tf 0.2 0.2 0.2 rg 125 510 Td (Downpayment) Tj ET`,
      `BT /F1 8 Tf 0.2 0.2 0.2 rg 185 510 Td (${Number(data.downpaymentAmount || 0)}) Tj ET`,
      `BT /F1 8 Tf 0.2 0.2 0.2 rg 235 510 Td (${totalPaidVal >= amountVal + Number(data.downpaymentAmount || 0) ? Number(data.downpaymentAmount || 0) : 0}) Tj ET`,
      `BT /F1 8 Tf 0.2 0.2 0.2 rg 295 510 Td (${totalPaidVal >= amountVal + Number(data.downpaymentAmount || 0) ? 0 : Number(data.downpaymentAmount || 0)}) Tj ET`,
      `BT /F1 7 Tf 0.4 0.4 0.4 rg 365 510 Td (Scheduled Due Date: ${data.downpaymentDueDate ? new Date(data.downpaymentDueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : shortPayDate}) Tj ET`,
    ] : [
      `BT /F1 8 Tf 0.2 0.2 0.2 rg 55 510 Td (${shortPayDate}) Tj ET`,
      `BT /F1 8 Tf 0.2 0.2 0.2 rg 125 510 Td (566) Tj ET`,
      `BT /F1 8 Tf 0.2 0.2 0.2 rg 185 510 Td (${finalFeeVal}) Tj ET`,
      `BT /F1 8 Tf 0.2 0.2 0.2 rg 235 510 Td (${totalPaidVal}) Tj ET`,
      `BT /F1 8 Tf 0.2 0.2 0.2 rg 295 510 Td (${remainingVal}) Tj ET`,
      `BT /F1 7 Tf 0.4 0.4 0.4 rg 365 510 Td (${receiptNo} ${shortPayDate} ${amountVal} ${mode}) Tj ET`,
    ]),

    // Totals Bar
    fillRoundedRect("0.88 0.88 0.88", 50, 490, 495, 16, 4),
    `BT /F2 8 Tf 0.1 0.1 0.1 rg 185 494 Td (${finalFeeVal}) Tj ET`,
    `BT /F2 8 Tf 0.1 0.5 0.2 rg 235 494 Td (${totalPaidVal}) Tj ET`,
    `BT /F2 8 Tf 0.7 0.1 0.1 rg 295 494 Td (${remainingVal}) Tj ET`,

    // Terms & Conditions Title
    `BT /F2 9.5 Tf 0.1 0.1 0.1 rg 50 465 Td (TERMS & CONDITIONS:) Tj ET`,
    `BT /F2 7.5 Tf 0.1 0.1 0.1 rg 50 450 Td (1. Payment Clearance:) Tj ET`,
    `BT /F1 7 Tf 0.2 0.2 0.2 rg 50 440 Td (Payments made through cheque are subject to realization. If a cheque is returned or dishonoured for any reason,) Tj ET`,
    `BT /F1 7 Tf 0.2 0.2 0.2 rg 50 431 Td (the student shall be liable to pay a handling charge of Rs. 500, along with any applicable bank charges.) Tj ET`,

    `BT /F2 7.5 Tf 0.1 0.1 0.1 rg 50 417 Td (2. Attendance & Schedule:) Tj ET`,
    `BT /F1 7 Tf 0.2 0.2 0.2 rg 50 408 Td (Students must strictly adhere to the batch timings and schedule allotted by the institute.) Tj ET`,

    `BT /F2 7.5 Tf 0.1 0.1 0.1 rg 50 394 Td (3. Transfer Policy:) Tj ET`,
    `BT /F1 7 Tf 0.2 0.2 0.2 rg 50 385 Td (Students enrolled under special schemes, promotional offers or discounts are not eligible for course transfer.) Tj ET`,

    `BT /F2 7.5 Tf 0.1 0.1 0.1 rg 50 371 Td (4. Receipt Preservation:) Tj ET`,
    `BT /F1 7 Tf 0.2 0.2 0.2 rg 50 362 Td (Students are advised to keep all fee receipts safely for certificate collection and future verification.) Tj ET`,

    `BT /F2 7.5 Tf 0.1 0.1 0.1 rg 50 348 Td (5. Code of Conduct:) Tj ET`,
    `BT /F1 7 Tf 0.2 0.2 0.2 rg 50 339 Td (Students are expected to maintain discipline, decorum, and professional behaviour at all times.) Tj ET`,

    `BT /F2 7.5 Tf 0.1 0.1 0.1 rg 50 325 Td (6. Institute Property:) Tj ET`,
    `BT /F1 7 Tf 0.2 0.2 0.2 rg 50 316 Td (Students shall be responsible for proper use of property. Damage due to negligence must be compensated.) Tj ET`,

    `BT /F2 7.5 Tf 0.7 0.1 0.1 rg 50 302 Td (7. FEE POLICY (IMPORTANT):) Tj ET`,
    `BT /F2 7 Tf 0.7 0.1 0.1 rg 50 293 Td (- All fees paid are non-refundable and non-transferable.) Tj ET`,
    `BT /F2 7 Tf 0.7 0.1 0.1 rg 50 284 Td (- Delayed fee payments shall attract a penalty of Rs. 200 per day.) Tj ET`,
    `BT /F2 7 Tf 0.7 0.1 0.1 rg 50 275 Td (- Students must not disclose fee structure / discount details to others.) Tj ET`,

    `BT /F2 7.5 Tf 0.1 0.1 0.1 rg 50 261 Td (8. Force Majeure:) Tj ET`,
    `BT /F1 7 Tf 0.2 0.2 0.2 rg 50 252 Td (Institute accepts no liability for delay due to natural disasters, floods, riots or events beyond control.) Tj ET`,

    `BT /F2 7.5 Tf 0.1 0.1 0.1 rg 50 238 Td (9. Course Validity & Curriculum:) Tj ET`,
    `BT /F1 7 Tf 0.2 0.2 0.2 rg 50 229 Td (Curriculum may be revised. Rejoining after a break requires joining available program or paying difference.) Tj ET`,

    `BT /F2 7.5 Tf 0.1 0.1 0.1 rg 50 215 Td (10. Course Completion Period:) Tj ET`,
    `BT /F1 7 Tf 0.2 0.2 0.2 rg 50 206 Td (- Certificate / Diploma / Short-Term Courses: Within 12 months from date of admission.) Tj ET`,
    `BT /F1 7 Tf 0.2 0.2 0.2 rg 50 197 Td (- Master Diploma Programmes: Within 24 months from date of admission.) Tj ET`,

    `BT /F2 7.5 Tf 0.1 0.1 0.1 rg 50 183 Td (11. Course Modification Policy:) Tj ET`,
    `BT /F1 7 Tf 0.2 0.2 0.2 rg 50 174 Td (Course upgrades permitted with approval and fee difference. Downgrades/lower value programs not allowed.) Tj ET`,

    // Authorised Signatory Line
    fillRoundedRect("0.5 0.5 0.5", 380, 110, 150, 1, 4),
    `BT /F2 8.5 Tf 0.2 0.2 0.2 rg 405 95 Td (Authorised Signatory) Tj ET`,

    // Footer Page Number
    `BT /F1 8 Tf 0.5 0.5 0.5 rg 490 30 Td (Page 1 of 1) Tj ET`,
  ];

  const p1Text = page1Lines.join("\n");

  const objects = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`);
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj`);
  objects.push(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);
  objects.push(`6 0 obj\n<< /Length ${Buffer.byteLength(p1Text)} >>\nstream\n${p1Text}\nendstream\nendobj`);

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

  // ─── HELPER: Pie arc slices ───
  function pieSlicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const steps = Math.ceil(Math.abs(endAngle - startAngle) / 45);
    const step = (endAngle - startAngle) / steps;
    let path = `${cx} ${cy} m `;
    path += `${(cx + r * Math.cos(toRad(startAngle))).toFixed(2)} ${(cy + r * Math.sin(toRad(startAngle))).toFixed(2)} l `;
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
    let path = `${(cx + outerR * Math.cos(sa)).toFixed(2)} ${(cy + outerR * Math.sin(sa)).toFixed(2)} m `;
    for (let i = 0; i < steps; i++) {
      const a0 = toRad(startAngle + i * step);
      const a1 = toRad(startAngle + (i + 1) * step);
      const da = a1 - a0;
      const alpha = (4 / 3) * Math.tan(da / 4);
      path += `${(cx + outerR * (Math.cos(a0) - alpha * Math.sin(a0))).toFixed(2)} ${(cy + outerR * (Math.sin(a0) + alpha * Math.cos(a0))).toFixed(2)} ${(cx + outerR * (Math.cos(a1) + alpha * Math.sin(a1))).toFixed(2)} ${(cy + outerR * (Math.sin(a1) - alpha * Math.cos(a1))).toFixed(2)} ${(cx + outerR * Math.cos(a1)).toFixed(2)} ${(cy + outerR * Math.sin(a1)).toFixed(2)} c `;
    }
    path += `${(cx + innerR * Math.cos(ea)).toFixed(2)} ${(cy + innerR * Math.sin(ea)).toFixed(2)} l `;
    for (let i = steps - 1; i >= 0; i--) {
      const a0 = toRad(startAngle + (i + 1) * step);
      const a1 = toRad(startAngle + i * step);
      const da = a1 - a0;
      const alpha = (4 / 3) * Math.tan(da / 4);
      path += `${(cx + innerR * (Math.cos(a0) - alpha * Math.sin(a0))).toFixed(2)} ${(cy + innerR * (Math.sin(a0) + alpha * Math.cos(a0))).toFixed(2)} ${(cx + innerR * (Math.cos(a1) + alpha * Math.sin(a1))).toFixed(2)} ${(cy + innerR * (Math.sin(a1) - alpha * Math.cos(a1))).toFixed(2)} ${(cx + innerR * Math.cos(a1)).toFixed(2)} ${(cy + innerR * Math.sin(a1)).toFixed(2)} c `;
    }
    path += "h f";
    return path;
  }

  const PALETTE = [
    "0.29 0.0 0.51",   // Indigo
    "0.02 0.59 0.41",  // Emerald
    "0.85 0.45 0.05",  // Amber
    "0.88 0.17 0.24",  // Rose
    "0.02 0.52 0.78",  // Cyan
    "0.48 0.22 0.93",  // Violet
  ];

  // KPI card: fixed-height 58px, top accent bar 3px
  const kpiCard = (x: number, y: number, w: number, accentCol: string, label: string, value: string, badge: string, badgeCol: string): string[] => {
    const h = 58;
    return [
      fillRoundedRect("0.97 0.97 0.99", x, y, w, h, 6),
      fillRoundedRect(accentCol, x, y + h - 3, w, 3, 2),
      `BT /F2 6.5 Tf 0.45 0.45 0.55 rg ${x + 8} ${y + h - 13} Td (${label}) Tj ET`,
      `BT /F2 10.5 Tf 0.08 0.10 0.22 rg ${x + 8} ${y + h - 27} Td (${value}) Tj ET`,
      fillRoundedRect(badgeCol, x + 8, y + 7, 68, 11, 4),
      `BT /F2 5.5 Tf 1 1 1 rg ${x + 11} ${y + 11} Td (${badge}) Tj ET`,
    ];
  };

  // ══════════════════════════════════════════════════════════════════════
  // PAGE 1  –  Fixed layout zones (all coordinates absolute)
  // Zone layout (Y from bottom):
  //   820-828: header
  //   760-818: header box
  //   754-760: accent
  //   694-752: KPI row 1 label + cards
  //   631-692: KPI row 2
  //   618-629: bar chart section label
  //   475-617: bar chart (left) + donut chart (right) side by side
  //   460-474: benchmark label
  //   385-459: benchmark bars
  //   372-384: funnel label
  //   295-371: funnel bars
  //   55-294:  footer separator
  // ══════════════════════════════════════════════════════════════════════
  const page1Lines: string[] = [];

  // Header box
  page1Lines.push(fillRoundedRect("0.08 0.12 0.28", 20, 760, 555, 60, 8));
  page1Lines.push(fillRoundedRect("0.12 0.18 0.38", 20, 760, 555, 30, 0));
  page1Lines.push(`BT /F2 13.5 Tf 1 1 1 rg 38 798 Td (COACHFLOW ERP  \xb7  EXECUTIVE BI MASTER REPORT) Tj ET`);
  page1Lines.push(`BT /F1 7.5 Tf 0.75 0.85 0.95 rg 38 782 Td (Date: ${dateStr}    |    Generated: ${genAtStr}    |    CoachFlow v3.2) Tj ET`);
  page1Lines.push(fillRoundedRect("0.29 0.0 0.51", 20, 757, 555, 3, 0));

  // KPI Section label
  page1Lines.push(`BT /F2 8.5 Tf 0.29 0.0 0.51 rg 22 743 Td (KEY PERFORMANCE INDICATORS) Tj ET`);

  // KPI Row 1 (Y base = 680, height = 58)
  page1Lines.push(...kpiCard(22,  680, 126, "0.02 0.59 0.41", "TOTAL REVENUE",     `Rs.${fmt(ex.totalRevenue?.value||0)}`,      fmtChg(ex.totalRevenue?.changePct||0)+" vs yest",       "0.02 0.59 0.41"));
  page1Lines.push(...kpiCard(155, 680, 126, "0.14 0.38 0.92", "TOTAL COLLECTIONS", `Rs.${fmt(ex.totalCollections?.value||0)}`,  fmtChg(ex.totalCollections?.changePct||0)+" vs yest", "0.14 0.38 0.92"));
  page1Lines.push(...kpiCard(288, 680, 126, "0.48 0.22 0.93", "TOTAL LEADS",       `${ex.totalLeads?.value||0} Enquiries`,      fmtChg(ex.totalLeads?.changePct||0)+" vs yest",       "0.48 0.22 0.93"));
  page1Lines.push(...kpiCard(421, 680, 154, "0.02 0.52 0.78", "ADMISSIONS",        `${ex.admissions?.value||0} Confirmed`,     fmtChg(ex.admissions?.changePct||0)+" vs yest",       "0.02 0.52 0.78"));

  // KPI Row 2 (Y base = 614)
  page1Lines.push(`BT /F2 8.5 Tf 0.29 0.0 0.51 rg 22 677 Td ( ) Tj ET`); // spacer
  page1Lines.push(...kpiCard(22,  614, 126, "0.85 0.45 0.05", "CONVERSION RATE",   `${ex.conversionRate?.value||0}%`,           "Target > 15%",     "0.85 0.45 0.05"));
  page1Lines.push(...kpiCard(155, 614, 126, "0.35 0.40 0.50", "OUTSTANDING FEES",  `Rs.${fmt(ex.outstandingFees?.value||0)}`,  "Pending Recovery",  "0.35 0.40 0.50"));
  page1Lines.push(...kpiCard(288, 614, 126, "0.88 0.17 0.24", "ESTIMATED LOSS",    `Rs.${fmt(ex.businessLoss?.value||0)}`,     "Unconverted Opp.",  "0.88 0.17 0.24"));
  page1Lines.push(...kpiCard(421, 614, 154, "0.7 0.15 0.55",  "UNCONVERTED",       `${loss.unconvertedLeads||0} Leads`,        "Priority Followup", "0.7 0.15 0.55"));

  // ── BRAND REVENUE BAR CHART (left panel, Y: 480–608) ──
  page1Lines.push(`BT /F2 8.5 Tf 0.29 0.0 0.51 rg 22 605 Td (BRAND REVENUE  \xb7  Daily Collections) Tj ET`);

  const BCX = 22, BCY = 480, BCH = 120, BCW = 340;
  const topBrands = brands.slice(0, 6);
  const maxBC = Math.max(...topBrands.map(b => b.dailyCollections || 0), 1);
  const bSlotW = topBrands.length > 0 ? Math.floor(BCW / topBrands.length) : 56;
  const bBarW = Math.min(38, bSlotW - 10);

  // Chart bg + grid lines
  page1Lines.push(fillRoundedRect("0.97 0.97 0.99", BCX, BCY, BCW, BCH, 6));
  [33, 66].forEach(pct => {
    const gy = (BCY + 4 + (pct / 100) * (BCH - 18)).toFixed(1);
    page1Lines.push(`0.91 0.91 0.93 RG ${BCX + 8} ${gy} m ${BCX + BCW - 8} ${gy} l s`);
  });

  topBrands.forEach((b, idx) => {
    const col = PALETTE[idx % PALETTE.length];
    const barH = Math.max(4, ((b.dailyCollections || 0) / maxBC) * (BCH - 22));
    const bx = BCX + idx * bSlotW + Math.floor((bSlotW - bBarW) / 2);
    const by = BCY + 4;
    // Shadow
    page1Lines.push(fillRoundedRect("0.87 0.87 0.91", bx + 2, by + 2, bBarW, barH, 3));
    // Bar
    page1Lines.push(fillRoundedRect(col, bx, by, bBarW, barH, 3));
    // Value label above bar (clipped to inside chart)
    const vLabel = (b.dailyCollections || 0) >= 100000
      ? `${((b.dailyCollections||0)/100000).toFixed(1)}L`
      : `${Math.round((b.dailyCollections||0)/1000)}K`;
    const labelY = Math.min(by + barH + 3, BCY + BCH - 6);
    page1Lines.push(`BT /F2 5.5 Tf 0.08 0.10 0.22 rg ${bx} ${labelY} Td (${vLabel}) Tj ET`);
    // Brand name below chart (strictly below BCY)
    const shortName = escapePdfText((b.brandName || "").slice(0, 9));
    page1Lines.push(`BT /F1 5 Tf 0.35 0.35 0.45 rg ${bx} ${BCY - 10} Td (${shortName}) Tj ET`);
  });

  // ── DONUT CHART (right panel, Y: 480–608, same row as bar chart) ──
  page1Lines.push(`BT /F2 8.5 Tf 0.29 0.0 0.51 rg 374 605 Td (PAYMENT MODE  \xb7  Donut Chart) Tj ET`);

  // Background panel
  page1Lines.push(fillRoundedRect("0.97 0.97 0.99", 372, BCY, 203, BCH, 6));

  const dCX = 430, dCY = BCY + 60, dOuter = 50, dInner = 26;
  const totalModeAmt = modes.reduce((s, m) => s + (m.amount || 0), 0) || 1;
  let dAngle = -90;
  modes.slice(0, 5).forEach((m, idx) => {
    const col = PALETTE[idx % PALETTE.length];
    const sweep = ((m.amount || 0) / totalModeAmt) * 360;
    if (sweep < 1) { dAngle += sweep; return; }
    page1Lines.push(`${col} rg ${donutSlicePath(dCX, dCY, dOuter, dInner, dAngle, dAngle + sweep)}`);
    dAngle += sweep;
  });
  // Center white hole
  page1Lines.push(fillRoundedRect("0.97 0.97 0.99", dCX - dInner, dCY - dInner, dInner * 2, dInner * 2, dInner));
  page1Lines.push(`BT /F2 5.5 Tf 0.29 0.0 0.51 rg ${dCX - 13} ${dCY + 3} Td (PAYMENT) Tj ET`);
  page1Lines.push(`BT /F2 5.5 Tf 0.29 0.0 0.51 rg ${dCX - 9} ${dCY - 7} Td (MODES) Tj ET`);

  // Legend — right of donut within panel
  let legY = dCY + 45;
  modes.slice(0, 4).forEach((m, idx) => {
    const col = PALETTE[idx % PALETTE.length];
    page1Lines.push(fillRoundedRect(col, 488, legY - 6, 7, 7, 2));
    page1Lines.push(`BT /F1 5.5 Tf 0.2 0.2 0.2 rg 498 ${legY - 1} Td (${escapePdfText((m.mode||"").slice(0,10))}: ${m.percentage}%) Tj ET`);
    legY -= 13;
  });

  // ── REVENUE BENCHMARK BAR CHART (Y: 385–470) ──
  page1Lines.push(`BT /F2 8.5 Tf 0.29 0.0 0.51 rg 22 472 Td (REVENUE BENCHMARK  \xb7  Today vs Yesterday vs Last Week) Tj ET`);

  const rbY = 385, rbH = 82, rbW = 555;
  page1Lines.push(fillRoundedRect("0.97 0.97 0.99", 22, rbY, rbW, rbH, 6));

  const maxComp = Math.max(comp.today || 0, comp.yesterday || 0, comp.sameDayLastWeek || 0, 1);
  [
    { label: "Today", value: comp.today || 0, col: "0.02 0.59 0.41", x: 40 },
    { label: "Yesterday", value: comp.yesterday || 0, col: "0.29 0.0 0.51", x: 225 },
    { label: "Last Week", value: comp.sameDayLastWeek || 0, col: "0.48 0.22 0.93", x: 410 },
  ].forEach(bd => {
    const bh = Math.max(4, (bd.value / maxComp) * (rbH - 26));
    const by = rbY + 4;
    page1Lines.push(fillRoundedRect("0.87 0.87 0.91", bd.x + 2, by + 2, 32, bh, 3));
    page1Lines.push(fillRoundedRect(bd.col, bd.x, by, 32, bh, 3));
    const amt = bd.value >= 100000 ? `Rs.${(bd.value/100000).toFixed(1)}L` : `Rs.${Math.round(bd.value/1000)}K`;
    const valLabelY = Math.min(by + bh + 4, rbY + rbH - 10);
    page1Lines.push(`BT /F2 6.5 Tf 0.08 0.10 0.22 rg ${bd.x} ${valLabelY} Td (${amt}) Tj ET`);
    page1Lines.push(`BT /F2 7 Tf ${bd.col} rg ${bd.x + 38} ${by + 2} Td (${bd.label}) Tj ET`);
    // Horizontal reference line
    page1Lines.push(`0.91 0.91 0.93 RG ${bd.x} ${rbY + rbH / 2} m ${bd.x + 160} ${rbY + rbH / 2} l s`);
  });

  // ── CONVERSION FUNNEL (Y: 295–376) ──
  page1Lines.push(`BT /F2 8.5 Tf 0.29 0.0 0.51 rg 22 377 Td (CONVERSION FUNNEL  \xb7  Lead Pipeline Stage Drop-Off) Tj ET`);

  const funnelItems = [
    { label: `Leads Received: ${funnel.leadsReceived}`,                                             pct: 100,  col: "0.29 0.0 0.51" },
    { label: `Followups: ${funnel.followupsCompleted} (${funnel.stagePercentages?.followupPct||0}%)`, pct: funnel.stagePercentages?.followupPct||0, col: "0.14 0.38 0.92" },
    { label: `Demos: ${funnel.demosScheduled} (${funnel.stagePercentages?.demoPct||0}%)`,          pct: funnel.stagePercentages?.demoPct||0,      col: "0.48 0.22 0.93" },
    { label: `Admissions: ${funnel.admissionsConfirmed} (${funnel.stagePercentages?.admissionPct||0}%)`, pct: funnel.stagePercentages?.admissionPct||0, col: "0.02 0.59 0.41" },
  ];

  let fY = 362;
  funnelItems.forEach(f => {
    const fw = Math.max(12, (f.pct / 100) * 540);
    page1Lines.push(fillRoundedRect("0.91 0.91 0.95", 22, fY - 11, 555, 15, 3));
    page1Lines.push(fillRoundedRect(f.col, 22, fY - 11, fw, 15, 3));
    page1Lines.push(`BT /F2 6.5 Tf 1 1 1 rg 28 ${fY - 5} Td (${escapePdfText(f.label)}) Tj ET`);
    fY -= 19;
  });

  // Footer
  page1Lines.push(fillRoundedRect("0.82 0.82 0.85", 20, 55, 555, 1, 0));
  page1Lines.push(`BT /F1 7 Tf 0.5 0.5 0.5 rg 22 42 Td (CoachFlow ERP  \xb7  Executive BI Report  \xb7  Page 1 of 2) Tj ET`);
  page1Lines.push(`BT /F1 7 Tf 0.5 0.5 0.5 rg 460 42 Td (Generated: ${genAtStr}) Tj ET`);

  // ══════════════════════════════════════════════════════════════════════
  // PAGE 2  –  Fixed layout zones
  // Zone layout (Y from bottom):
  //   760-820: header
  //   736-758: counsellor section label + table header
  //   666-735: counsellor rows (max 5 x 14px)
  //   570-664: pie chart (left) + marketing ROI bars (right) side by side
  //   480-568: EMI list
  //   420-478: predictive targets
  //   238-418: AI dark card
  //   55-237:  footer
  // ══════════════════════════════════════════════════════════════════════
  const page2Lines: string[] = [];

  // Header
  page2Lines.push(fillRoundedRect("0.08 0.12 0.28", 20, 760, 555, 60, 8));
  page2Lines.push(fillRoundedRect("0.12 0.18 0.38", 20, 760, 555, 30, 0));
  page2Lines.push(`BT /F2 13.5 Tf 1 1 1 rg 38 798 Td (COACHFLOW ERP  \xb7  SALES & FINANCIAL INTELLIGENCE) Tj ET`);
  page2Lines.push(`BT /F1 7.5 Tf 0.75 0.85 0.95 rg 38 782 Td (Date: ${dateStr}    |    Page 2 of 2    |    CoachFlow Decision Support Engine v3.2) Tj ET`);
  page2Lines.push(fillRoundedRect("0.02 0.59 0.41", 20, 757, 555, 3, 0));

  // ── Counsellor Table (fixed top at Y=742) ──
  page2Lines.push(`BT /F2 8.5 Tf 0.29 0.0 0.51 rg 22 743 Td (COUNSELLOR PERFORMANCE SCORECARD) Tj ET`);
  page2Lines.push(fillRoundedRect("0.12 0.18 0.38", 22, 724, 555, 15, 4));
  const cols2 = [
    { x: 28,  label: "Name"        },
    { x: 158, label: "Scope"       },
    { x: 218, label: "Leads"       },
    { x: 258, label: "Adm"         },
    { x: 300, label: "Conv%"       },
    { x: 348, label: "Collections" },
    { x: 455, label: "Status"      },
  ];
  cols2.forEach(c => page2Lines.push(`BT /F2 7 Tf 1 1 1 rg ${c.x} 730 Td (${c.label}) Tj ET`));

  let cpY = 712;
  counsellors.slice(0, 5).forEach((cs, idx) => {
    const bg = idx % 2 === 0 ? "0.96 0.97 0.99" : "1 1 1";
    page2Lines.push(fillRoundedRect(bg, 22, cpY - 2, 555, 14, 2));
    page2Lines.push(`BT /F1 6.5 Tf 0.12 0.12 0.22 rg 28 ${cpY + 2} Td (${escapePdfText((cs.name||"").slice(0,18))}) Tj ET`);
    page2Lines.push(`BT /F1 6.5 Tf 0.12 0.12 0.22 rg 158 ${cpY + 2} Td (${escapePdfText((cs.brandScope||"").slice(0,12))}) Tj ET`);
    page2Lines.push(`BT /F1 6.5 Tf 0.12 0.12 0.22 rg 218 ${cpY + 2} Td (${cs.leadsAssigned}) Tj ET`);
    page2Lines.push(`BT /F1 6.5 Tf 0.12 0.12 0.22 rg 258 ${cpY + 2} Td (${cs.admissionsConverted}) Tj ET`);
    page2Lines.push(`BT /F1 6.5 Tf 0.12 0.12 0.22 rg 300 ${cpY + 2} Td (${cs.conversionPct}%) Tj ET`);
    page2Lines.push(`BT /F2 6.5 Tf 0.02 0.59 0.41 rg 348 ${cpY + 2} Td (Rs.${fmt(cs.collectionsGenerated||0)}) Tj ET`);
    const tagCol = cs.isTopPerformer ? "0.02 0.59 0.41" : cs.isLowPerformer ? "0.88 0.17 0.24" : "0.14 0.38 0.92";
    const tag = cs.isTopPerformer ? "Top Performer" : cs.isLowPerformer ? "Low Velocity" : "Active";
    page2Lines.push(fillRoundedRect(tagCol, 455, cpY - 1, 64, 12, 3));
    page2Lines.push(`BT /F2 5.5 Tf 1 1 1 rg 458 ${cpY + 3} Td (${tag}) Tj ET`);
    cpY -= 14;
  });

  // ── PIE CHART (left panel, Y: 570–660) + MARKETING ROI BARS (right panel) ──
  const sectionPieY = 660;
  page2Lines.push(`BT /F2 8.5 Tf 0.29 0.0 0.51 rg 22 ${sectionPieY + 2} Td (LEAD SOURCE PIE CHART  \xb7  Marketing ROI Distribution) Tj ET`);
  page2Lines.push(fillRoundedRect("0.97 0.97 0.99", 22, 575, 268, 82, 6));

  const pieCX = 100, pieCY = 620, pieR = 38;
  const totalSrcLeads = sources.reduce((s, src) => s + (src.leadsGenerated || 0), 0) || 1;
  let pAngle = -90;
  sources.slice(0, 5).forEach((src, idx) => {
    const col = PALETTE[idx % PALETTE.length];
    const sweep = ((src.leadsGenerated || 0) / totalSrcLeads) * 360;
    if (sweep < 1) { pAngle += sweep; return; }
    page2Lines.push(`${col} rg ${pieSlicePath(pieCX, pieCY, pieR, pAngle, pAngle + sweep)}`);
    pAngle += sweep;
  });

  // Pie legend (to the right of pie, inside same panel)
  let pieLegY = 653;
  sources.slice(0, 5).forEach((src, idx) => {
    const col = PALETTE[idx % PALETTE.length];
    page2Lines.push(fillRoundedRect(col, 148, pieLegY - 6, 7, 7, 2));
    page2Lines.push(`BT /F1 5.5 Tf 0.1 0.1 0.2 rg 158 ${pieLegY - 1} Td (${escapePdfText((src.source||"").slice(0,14))}: ${src.leadsGenerated}) Tj ET`);
    pieLegY -= 13;
  });

  // Marketing ROI Bars right panel
  page2Lines.push(`BT /F2 8.5 Tf 0.29 0.0 0.51 rg 300 ${sectionPieY + 2} Td (MARKETING ROI  \xb7  Revenue per Source) Tj ET`);
  page2Lines.push(fillRoundedRect("0.97 0.97 0.99", 298, 575, 279, 82, 6));
  const srcMaxRev = Math.max(...sources.map(s => s.revenueContribution || 0), 1);
  let srcBY = 648;
  sources.slice(0, 5).forEach((src, idx) => {
    const col = PALETTE[idx % PALETTE.length];
    const bw = Math.max(5, ((src.revenueContribution || 0) / srcMaxRev) * 230);
    page2Lines.push(fillRoundedRect("0.91 0.91 0.95", 304, srcBY - 8, 265, 11, 3));
    page2Lines.push(fillRoundedRect(col, 304, srcBY - 8, bw, 11, 3));
    page2Lines.push(`BT /F1 5.5 Tf 1 1 1 rg 307 ${srcBY - 3} Td (${escapePdfText((src.source||"").slice(0,12))}: Rs.${fmt(src.revenueContribution||0)}) Tj ET`);
    srcBY -= 14;
  });

  // ── EMI PRIORITY LIST (Y: 480–568) ──
  page2Lines.push(`BT /F2 8.5 Tf 0.29 0.0 0.51 rg 22 568 Td (OVERDUE EMI  \xb7  Priority Follow-Up List) Tj ET`);
  page2Lines.push(fillRoundedRect("0.7 0.2 0.2", 22, 550, 555, 15, 4));
  const emiCols = [
    { x: 28,  label: "Student Name" },
    { x: 175, label: "Course"       },
    { x: 305, label: "Phone"        },
    { x: 403, label: "Balance Due"  },
    { x: 494, label: "Due Date"     },
  ];
  emiCols.forEach(c => page2Lines.push(`BT /F2 7 Tf 1 1 1 rg ${c.x} 556 Td (${c.label}) Tj ET`));
  let emiY = 540;
  (pending.studentsRequiringFollowup || []).slice(0, 4).forEach((st, idx) => {
    const bg = idx % 2 === 0 ? "0.99 0.96 0.96" : "1 1 1";
    page2Lines.push(fillRoundedRect(bg, 22, emiY - 2, 555, 13, 2));
    page2Lines.push(`BT /F1 6.5 Tf 0.12 0.12 0.22 rg 28 ${emiY + 2} Td (${escapePdfText((st.fullName||"").slice(0,20))}) Tj ET`);
    page2Lines.push(`BT /F1 6.5 Tf 0.12 0.12 0.22 rg 175 ${emiY + 2} Td (${escapePdfText((st.course||"").slice(0,16))}) Tj ET`);
    page2Lines.push(`BT /F1 6.5 Tf 0.12 0.12 0.22 rg 305 ${emiY + 2} Td (${escapePdfText(st.mobileNumber||"")}) Tj ET`);
    page2Lines.push(`BT /F2 6.5 Tf 0.7 0.1 0.1 rg 403 ${emiY + 2} Td (Rs.${fmt(st.remainingBalance||0)}) Tj ET`);
    page2Lines.push(`BT /F1 6.5 Tf 0.3 0.3 0.4 rg 494 ${emiY + 2} Td (${escapePdfText(st.nextDueDate||"")}) Tj ET`);
    emiY -= 13;
  });

  // ── PREDICTIVE TARGETS (Y: 420–478) ──
  page2Lines.push(`BT /F2 8.5 Tf 0.29 0.0 0.51 rg 22 476 Td (TOMORROW'S TARGETS  \xb7  Predictive Business Goals) Tj ET`);
  page2Lines.push(fillRoundedRect("0.97 0.97 0.99", 22, 422, 555, 50, 6));

  const tItems = [
    { label: "Revenue Target",     val: targets.revenueTarget||0,     col: "0.02 0.59 0.41", x: 28 },
    { label: "Collections Target", val: targets.collectionsTarget||0, col: "0.14 0.38 0.92", x: 215 },
    { label: "Admissions Goal",    val: (targets.admissionsTarget||0)*10000, col: "0.48 0.22 0.93", x: 402 },
  ];
  const maxTgt = Math.max(...tItems.map(t => t.val), 1);
  tItems.forEach(t => {
    const tw = Math.max(5, (t.val / maxTgt) * 155);
    const display = t.label === "Admissions Goal" ? `${targets.admissionsTarget||0} Students` : `Rs.${fmt(t.val)}`;
    page2Lines.push(`BT /F2 6 Tf 0.29 0.0 0.51 rg ${t.x} 467 Td (${t.label}) Tj ET`);
    page2Lines.push(fillRoundedRect("0.87 0.87 0.91", t.x, 450, 165, 10, 3));
    page2Lines.push(fillRoundedRect(t.col, t.x, 450, tw, 10, 3));
    page2Lines.push(`BT /F1 6 Tf 0.12 0.12 0.22 rg ${t.x} 436 Td (${display}) Tj ET`);
  });

  // ── AI SYNTHESIS DARK CARD (Y: 238–418) ──
  page2Lines.push(`BT /F2 8.5 Tf 0.29 0.0 0.51 rg 22 418 Td (AI SYNTHESIS  \xb7  Strategic Executive Insights) Tj ET`);
  page2Lines.push(fillRoundedRect("0.06 0.09 0.16", 22, 238, 555, 176, 8));
  page2Lines.push(fillRoundedRect("0.29 0.0 0.51", 22, 410, 555, 4, 4));

  page2Lines.push(`BT /F2 9 Tf 0.34 0.8 0.95 rg 32 400 Td (AUTOMATED EXECUTIVE OBSERVATION SUMMARY) Tj ET`);
  page2Lines.push(`BT /F1 7 Tf 0.85 0.85 0.9 rg 32 386 Td (${escapePdfText((ai.executiveSummary||"Monitoring active across all CRM, admissions & financial streams.").slice(0,100))}) Tj ET`);

  page2Lines.push(`BT /F2 7.5 Tf 0.4 0.9 0.5 rg 32 368 Td (KEY ACHIEVEMENTS TODAY) Tj ET`);
  let aY = 354;
  (ai.keyAchievements || []).slice(0, 3).forEach(ach => {
    page2Lines.push(fillRoundedRect("0.02 0.59 0.41", 32, aY - 3, 5, 5, 2));
    page2Lines.push(`BT /F1 6.5 Tf 0.92 0.95 0.98 rg 40 ${aY} Td (${escapePdfText((ach||"").slice(0,95))}) Tj ET`);
    aY -= 12;
  });

  aY -= 5;
  page2Lines.push(`BT /F2 7.5 Tf 1 0.7 0.3 rg 32 ${aY} Td (RECOMMENDED ACTIONS FOR TOMORROW) Tj ET`);
  aY -= 12;
  (ai.recommendedPriorityActions || []).slice(0, 3).forEach(act => {
    page2Lines.push(fillRoundedRect("0.85 0.45 0.05", 32, aY - 3, 5, 5, 2));
    page2Lines.push(`BT /F1 6.5 Tf 0.92 0.95 0.98 rg 40 ${aY} Td (${escapePdfText((act||"").slice(0,95))}) Tj ET`);
    aY -= 12;
  });

  // Footer
  page2Lines.push(fillRoundedRect("0.82 0.82 0.85", 20, 55, 555, 1, 0));
  page2Lines.push(`BT /F1 7 Tf 0.5 0.5 0.5 rg 22 42 Td (CoachFlow ERP  \xb7  Executive BI Report  \xb7  Official Report) Tj ET`);
  page2Lines.push(`BT /F1 7 Tf 0.5 0.5 0.5 rg 488 42 Td (Page 2 of 2) Tj ET`);

  // ── Assemble PDF ──
  const p1Text = page1Lines.join("\n");
  const p2Text = page2Lines.join("\n");

  const objects: string[] = [];
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
  let offset = Buffer.byteLength(header);

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i] + "\n";
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
    body += obj;
    offset += Buffer.byteLength(obj);
  }

  return Buffer.from(header + body + xref + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`, "utf-8");
}

export interface ExpensePdfData {
  expenses: any[];
  filters: {
    category?: string;
    brand?: string;
    company?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  };
  generatedAtStr?: string;
}

export function generateExpensePdfBuffer(data: ExpensePdfData): Buffer {
  const expenses = data.expenses || [];
  const filters = data.filters || {};

  const totalAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalCount = expenses.length;

  const variableTotal = expenses
    .filter((e) => (e.expenseType || "variable").toLowerCase() === "variable")
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const fixedTotal = expenses
    .filter((e) => (e.expenseType || "").toLowerCase() === "fixed")
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const cashTotal = expenses
    .filter((e) => (e.paymentMode || "").toLowerCase() === "cash")
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const bankTotal = Math.max(0, totalAmount - cashTotal);

  const fmt = (n: number) => Math.round(n).toLocaleString("en-IN");

  // Dynamic pagination calculation for ALL expenses
  const remainingCount = Math.max(0, totalCount - 12);
  const continuationPageCount = Math.max(1, Math.ceil(remainingCount / 38));
  const totalPages = 1 + continuationPageCount;

  const pageStreams: string[] = [];

  // ── PAGE 1 CONTENT STREAM ──
  const p1Lines: string[] = [];

  // Header Banner (Y: 760..820)
  p1Lines.push(fillRoundedRect("0.12 0.10 0.29", 20, 760, 555, 60, 6));
  p1Lines.push(`BT /F2 13 Tf 1 1 1 rg 35 798 Td (COACHFLOW ERP  \xb7  FINANCIAL INTELLIGENCE SUITE) Tj ET`);
  p1Lines.push(`BT /F2 9.5 Tf 0.8 0.85 0.98 rg 35 778 Td (OPERATIONAL EXPENSE EXECUTIVE REPORT) Tj ET`);
  p1Lines.push(`BT /F1 7.5 Tf 0.7 0.8 0.95 rg 400 798 Td (Generated: ${escapePdfText(data.generatedAtStr || new Date().toLocaleDateString("en-IN"))}) Tj ET`);
  p1Lines.push(`BT /F1 7.5 Tf 0.7 0.8 0.95 rg 400 778 Td (Total Records: ${totalCount}) Tj ET`);

  // Sub-header Filter Strip (Y: 732..752)
  p1Lines.push(fillRoundedRect("0.95 0.96 0.98", 20, 732, 555, 20, 4));
  p1Lines.push(`BT /F2 7.5 Tf 0.2 0.25 0.35 rg 30 738 Td (FILTERS: Brand: ${escapePdfText((filters.brand || "All Brands").slice(0, 15))}) Tj ET`);
  p1Lines.push(`BT /F2 7.5 Tf 0.2 0.25 0.35 rg 210 738 Td (Company: ${escapePdfText((filters.company || "All Companies").slice(0, 15))}) Tj ET`);
  p1Lines.push(`BT /F2 7.5 Tf 0.2 0.25 0.35 rg 390 738 Td (Category: ${escapePdfText((filters.category || "All").slice(0, 15))}) Tj ET`);

  // KPI Scorecards (Y: 660..720)
  p1Lines.push(fillRoundedRect("1.0 0.95 0.96", 20, 660, 132, 60, 6));
  p1Lines.push(fillRoundedRect("0.88 0.11 0.28", 20, 660, 4, 60, 2));
  p1Lines.push(`BT /F2 7 Tf 0.6 0.1 0.2 rg 30 705 Td (TOTAL SPEND) Tj ET`);
  p1Lines.push(`BT /F2 10.5 Tf 0.75 0.07 0.23 rg 30 688 Td (Rs.${fmt(totalAmount)}) Tj ET`);
  p1Lines.push(`BT /F1 6.5 Tf 0.5 0.5 0.5 rg 30 672 Td (${totalCount} Vouchers) Tj ET`);

  p1Lines.push(fillRoundedRect("0.98 0.95 1.0", 161, 660, 132, 60, 6));
  p1Lines.push(fillRoundedRect("0.58 0.2 0.92", 161, 660, 4, 60, 2));
  p1Lines.push(`BT /F2 7 Tf 0.4 0.1 0.6 rg 171 705 Td (VARIABLE SPEND) Tj ET`);
  p1Lines.push(`BT /F2 10.5 Tf 0.49 0.13 0.82 rg 171 688 Td (Rs.${fmt(variableTotal)}) Tj ET`);
  p1Lines.push(`BT /F1 6.5 Tf 0.5 0.5 0.5 rg 171 672 Td (${totalAmount > 0 ? ((variableTotal / totalAmount) * 100).toFixed(1) : 0}% Share) Tj ET`);

  p1Lines.push(fillRoundedRect("0.93 0.95 1.0", 302, 660, 132, 60, 6));
  p1Lines.push(fillRoundedRect("0.31 0.27 0.9", 302, 660, 4, 60, 2));
  p1Lines.push(`BT /F2 7 Tf 0.2 0.2 0.6 rg 312 705 Td (FIXED SPEND) Tj ET`);
  p1Lines.push(`BT /F2 10.5 Tf 0.26 0.22 0.79 rg 312 688 Td (Rs.${fmt(fixedTotal)}) Tj ET`);
  p1Lines.push(`BT /F1 6.5 Tf 0.5 0.5 0.5 rg 312 672 Td (${totalAmount > 0 ? ((fixedTotal / totalAmount) * 100).toFixed(1) : 0}% Share) Tj ET`);

  p1Lines.push(fillRoundedRect("0.92 0.99 0.96", 443, 660, 132, 60, 6));
  p1Lines.push(fillRoundedRect("0.02 0.59 0.41", 443, 660, 4, 60, 2));
  p1Lines.push(`BT /F2 7 Tf 0.0 0.4 0.3 rg 453 705 Td (BANK / CASH RATIO) Tj ET`);
  p1Lines.push(`BT /F2 10.5 Tf 0.02 0.47 0.34 rg 453 688 Td (${totalAmount > 0 ? ((bankTotal / totalAmount) * 100).toFixed(0) : 0}% Digital) Tj ET`);
  p1Lines.push(`BT /F1 6.5 Tf 0.5 0.5 0.5 rg 453 672 Td (Cash: Rs.${fmt(cashTotal)}) Tj ET`);

  // Visual Analytics Section Divider (Y: 636)
  p1Lines.push(fillRoundedRect("0.06 0.09 0.16", 20, 636, 555, 18, 4));
  p1Lines.push(`BT /F2 8.5 Tf 1 1 1 rg 30 641 Td (FINANCIAL INSIGHT GRAPH ANALYTICS & BREAKDOWN CHARTS) Tj ET`);

  // GRAPH 1: Category Spend Breakdown
  p1Lines.push(fillRoundedRect("1 1 1", 20, 480, 270, 146, 6));
  p1Lines.push(strokeRoundedRect("0.85 0.88 0.92", 20, 480, 270, 146, 6));
  p1Lines.push(`BT /F2 8.5 Tf 0.12 0.16 0.23 rg 30 612 Td (GRAPH 1: TOP CATEGORY ALLOCATION) Tj ET`);

  const categoryMap: Record<string, number> = {};
  expenses.forEach((e) => {
    const cat = e.category || "Misc";
    categoryMap[cat] = (categoryMap[cat] || 0) + (Number(e.amount) || 0);
  });
  const topCategories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCatVal = Math.max(...topCategories.map((c) => c[1]), 1);

  let cY = 590;
  const barColors = ["0.31 0.27 0.9", "0.88 0.11 0.28", "0.58 0.2 0.92", "0.02 0.59 0.41", "0.96 0.62 0.04"];
  topCategories.forEach(([catName, amt], idx) => {
    const barW = Math.max((amt / maxCatVal) * 105, 5);
    const col = barColors[idx % barColors.length];
    const pct = totalAmount > 0 ? ((amt / totalAmount) * 100).toFixed(1) : "0.0";

    p1Lines.push(`BT /F2 7 Tf 0.25 0.28 0.35 rg 30 ${cY} Td (${escapePdfText(catName.slice(0, 14))}) Tj ET`);
    p1Lines.push(fillRoundedRect(col, 115, cY - 2, barW, 9, 2));
    p1Lines.push(`BT /F2 6.5 Tf 0.1 0.1 0.2 rg ${120 + barW} ${cY} Td (Rs.${fmt(amt)} [${pct}%]) Tj ET`);
    cY -= 20;
  });

  // GRAPH 2: Payment Mode Breakdown
  p1Lines.push(fillRoundedRect("1 1 1", 305, 480, 270, 146, 6));
  p1Lines.push(strokeRoundedRect("0.85 0.88 0.92", 305, 480, 270, 146, 6));
  p1Lines.push(`BT /F2 8.5 Tf 0.12 0.16 0.23 rg 315 612 Td (GRAPH 2: PAYMENT MODE BREAKDOWN) Tj ET`);

  const paymentMap: Record<string, number> = {};
  expenses.forEach((e) => {
    const mode = e.paymentMode || "Cash";
    paymentMap[mode] = (paymentMap[mode] || 0) + (Number(e.amount) || 0);
  });
  const paymentModes = Object.entries(paymentMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  let pY = 590;
  const pColors = ["0.02 0.59 0.41", "0.96 0.62 0.04", "0.23 0.51 0.96", "0.55 0.36 0.96", "0.93 0.28 0.6"];
  paymentModes.forEach(([mode, amt], idx) => {
    const col = pColors[idx % pColors.length];
    const pct = totalAmount > 0 ? ((amt / totalAmount) * 100).toFixed(1) : "0.0";

    p1Lines.push(fillRoundedRect(col, 315, pY - 1, 8, 8, 2));
    p1Lines.push(`BT /F2 7.5 Tf 0.2 0.25 0.35 rg 328 ${pY} Td (${escapePdfText(mode)}) Tj ET`);
    p1Lines.push(`BT /F2 7.5 Tf 0.1 0.1 0.2 rg 450 ${pY} Td (Rs.${fmt(amt)} [${pct}%]) Tj ET`);
    pY -= 20;
  });

  // GRAPH 3: Variable vs Fixed Nature Comparison
  p1Lines.push(fillRoundedRect("1 1 1", 20, 360, 270, 108, 6));
  p1Lines.push(strokeRoundedRect("0.85 0.88 0.92", 20, 360, 270, 108, 6));
  p1Lines.push(`BT /F2 8.5 Tf 0.12 0.16 0.23 rg 30 452 Td (GRAPH 3: COST NATURE COMPARISON) Tj ET`);

  const varPct = totalAmount > 0 ? Math.round((variableTotal / totalAmount) * 100) : 0;
  const fixPct = totalAmount > 0 ? Math.round((fixedTotal / totalAmount) * 100) : 0;

  p1Lines.push(`BT /F2 7.5 Tf 0.49 0.13 0.82 rg 30 432 Td (Variable Spend: Rs.${fmt(variableTotal)} [${varPct}%]) Tj ET`);
  p1Lines.push(fillRoundedRect("0.58 0.2 0.92", 30, 418, Math.max((varPct / 100) * 240, 5), 10, 3));

  p1Lines.push(`BT /F2 7.5 Tf 0.26 0.22 0.79 rg 30 400 Td (Fixed Overhead: Rs.${fmt(fixedTotal)} [${fixPct}%]) Tj ET`);
  p1Lines.push(fillRoundedRect("0.31 0.27 0.9", 30, 386, Math.max((fixPct / 100) * 240, 5), 10, 3));

  // GRAPH 4: Brand Allocation Breakdown
  p1Lines.push(fillRoundedRect("1 1 1", 305, 360, 270, 108, 6));
  p1Lines.push(strokeRoundedRect("0.85 0.88 0.92", 305, 360, 270, 108, 6));
  p1Lines.push(`BT /F2 8.5 Tf 0.12 0.16 0.23 rg 315 452 Td (GRAPH 4: BRAND SPEND ALLOCATION) Tj ET`);

  const brandMap: Record<string, number> = {};
  expenses.forEach((e) => {
    const b = e.brand && e.brand !== "All Brands" ? e.brand : "Unassigned";
    brandMap[b] = (brandMap[b] || 0) + (Number(e.amount) || 0);
  });
  const brandModes = Object.entries(brandMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxBrandVal = Math.max(...brandModes.map((b) => b[1]), 1);

  let bY = 432;
  brandModes.forEach(([bName, amt]) => {
    const bW = Math.max((amt / maxBrandVal) * 105, 5);
    p1Lines.push(`BT /F2 7 Tf 0.25 0.28 0.35 rg 315 ${bY} Td (${escapePdfText(bName.slice(0, 14))}) Tj ET`);
    p1Lines.push(fillRoundedRect("0.01 0.52 0.78", 390, bY - 2, bW, 8, 2));
    p1Lines.push(`BT /F2 6.5 Tf 0.1 0.1 0.2 rg ${394 + bW} ${bY} Td (Rs.${fmt(amt)}) Tj ET`);
    bY -= 18;
  });

  // Table Section Header
  p1Lines.push(fillRoundedRect("0.12 0.16 0.23", 20, 334, 555, 18, 4));
  p1Lines.push(`BT /F2 8.5 Tf 1 1 1 rg 30 339 Td (EXPENSE REGISTER VOUCHERS AUDIT TRAIL) Tj ET`);

  // Table Header Row Page 1 (Y: 312)
  p1Lines.push(fillRoundedRect("0.2 0.25 0.35", 20, 312, 555, 18, 2));
  p1Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 25 317 Td (#) Tj ET`);
  p1Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 50 317 Td (Date) Tj ET`);
  p1Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 110 317 Td (Category) Tj ET`);
  p1Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 200 317 Td (Title / Description) Tj ET`);
  p1Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 330 317 Td (Amount) Tj ET`);
  p1Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 390 317 Td (Mode) Tj ET`);
  p1Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 440 317 Td (Brand) Tj ET`);
  p1Lines.push(`BT /F2 7.5 Tf 1 1 1 rg 510 317 Td (Nature) Tj ET`);

  // Render Page 1 First 12 Rows
  let rY = 295;
  const page1Rows = expenses.slice(0, 12);
  page1Rows.forEach((exp, idx) => {
    if (idx % 2 === 1) p1Lines.push(fillRoundedRect("0.96 0.97 0.98", 20, rY - 2, 555, 15, 0));

    const dateStr = exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString("en-IN") : "-";
    p1Lines.push(`BT /F1 7 Tf 0.3 0.3 0.4 rg 25 ${rY} Td (${idx + 1}) Tj ET`);
    p1Lines.push(`BT /F1 7 Tf 0.1 0.1 0.2 rg 50 ${rY} Td (${escapePdfText(dateStr)}) Tj ET`);
    p1Lines.push(`BT /F2 7 Tf 0.7 0.1 0.2 rg 110 ${rY} Td (${escapePdfText((exp.category || "Misc").slice(0, 15))}) Tj ET`);
    p1Lines.push(`BT /F1 7 Tf 0.1 0.1 0.2 rg 200 ${rY} Td (${escapePdfText((exp.title || "").slice(0, 24))}) Tj ET`);
    p1Lines.push(`BT /F2 7 Tf 0.7 0.05 0.2 rg 330 ${rY} Td (Rs.${fmt(Number(exp.amount) || 0)}) Tj ET`);
    p1Lines.push(`BT /F1 7 Tf 0.3 0.3 0.4 rg 390 ${rY} Td (${escapePdfText((exp.paymentMode || "Cash").slice(0, 8))}) Tj ET`);
    p1Lines.push(`BT /F1 7 Tf 0.3 0.3 0.4 rg 440 ${rY} Td (${escapePdfText((exp.brand || "-").slice(0, 10))}) Tj ET`);
    p1Lines.push(`BT /F1 7 Tf 0.3 0.3 0.4 rg 510 ${rY} Td (${escapePdfText((exp.expenseType || "variable").slice(0, 9))}) Tj ET`);

    rY -= 17;
  });

  // Page 1 Footer
  p1Lines.push(fillRoundedRect("0.82 0.82 0.85", 20, 35, 555, 1, 0));
  p1Lines.push(`BT /F1 7 Tf 0.5 0.5 0.5 rg 22 22 Td (CoachFlow ERP  \xb7  Operational Expense Report  \xb7  Confidential) Tj ET`);
  p1Lines.push(`BT /F1 7 Tf 0.5 0.5 0.5 rg 488 22 Td (Page 1 of ${totalPages}) Tj ET`);

  pageStreams.push(p1Lines.join("\n"));

  // ── CONTINUATION PAGES (PAGE 2 TO N) ──
  const remainingExpenses = expenses.slice(12);

  for (let pageIdx = 0; pageIdx < continuationPageCount; pageIdx++) {
    const pageNum = pageIdx + 2;
    const pageLines: string[] = [];

    // Header Bar
    pageLines.push(fillRoundedRect("0.12 0.10 0.29", 20, 780, 555, 40, 4));
    pageLines.push(`BT /F2 12 Tf 1 1 1 rg 35 798 Td (OPERATIONAL EXPENSE DETAILED REGISTER) Tj ET`);
    pageLines.push(`BT /F1 8 Tf 0.8 0.85 0.98 rg 35 785 Td (Vouchers Register & Audit Continuation Sheet - Page ${pageNum} of ${totalPages}) Tj ET`);

    // Table Header Row
    pageLines.push(fillRoundedRect("0.2 0.25 0.35", 20, 755, 555, 18, 2));
    pageLines.push(`BT /F2 7.5 Tf 1 1 1 rg 25 760 Td (#) Tj ET`);
    pageLines.push(`BT /F2 7.5 Tf 1 1 1 rg 50 760 Td (Date) Tj ET`);
    pageLines.push(`BT /F2 7.5 Tf 1 1 1 rg 110 760 Td (Category) Tj ET`);
    pageLines.push(`BT /F2 7.5 Tf 1 1 1 rg 200 760 Td (Title / Description) Tj ET`);
    pageLines.push(`BT /F2 7.5 Tf 1 1 1 rg 330 760 Td (Amount) Tj ET`);
    pageLines.push(`BT /F2 7.5 Tf 1 1 1 rg 390 760 Td (Mode) Tj ET`);
    pageLines.push(`BT /F2 7.5 Tf 1 1 1 rg 440 760 Td (Brand) Tj ET`);
    pageLines.push(`BT /F2 7.5 Tf 1 1 1 rg 510 760 Td (Nature) Tj ET`);

    const chunk = remainingExpenses.slice(pageIdx * 38, (pageIdx + 1) * 38);
    let pY = 735;

    if (chunk.length === 0 && pageNum === 2) {
      pageLines.push(`BT /F1 8 Tf 0.5 0.5 0.5 rg 200 ${pY} Td (All expense vouchers listed on Page 1.) Tj ET`);
    } else {
      chunk.forEach((exp, rowIdx) => {
        const globalIdx = 13 + pageIdx * 38 + rowIdx;
        if (rowIdx % 2 === 1) pageLines.push(fillRoundedRect("0.96 0.97 0.98", 20, pY - 2, 555, 15, 0));

        const dateStr = exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString("en-IN") : "-";
        pageLines.push(`BT /F1 7 Tf 0.3 0.3 0.4 rg 25 ${pY} Td (${globalIdx}) Tj ET`);
        pageLines.push(`BT /F1 7 Tf 0.1 0.1 0.2 rg 50 ${pY} Td (${escapePdfText(dateStr)}) Tj ET`);
        pageLines.push(`BT /F2 7 Tf 0.7 0.1 0.2 rg 110 ${pY} Td (${escapePdfText((exp.category || "Misc").slice(0, 15))}) Tj ET`);
        pageLines.push(`BT /F1 7 Tf 0.1 0.1 0.2 rg 200 ${pY} Td (${escapePdfText((exp.title || "").slice(0, 24))}) Tj ET`);
        pageLines.push(`BT /F2 7 Tf 0.7 0.05 0.2 rg 330 ${pY} Td (Rs.${fmt(Number(exp.amount) || 0)}) Tj ET`);
        pageLines.push(`BT /F1 7 Tf 0.3 0.3 0.4 rg 390 ${pY} Td (${escapePdfText((exp.paymentMode || "Cash").slice(0, 8))}) Tj ET`);
        pageLines.push(`BT /F1 7 Tf 0.3 0.3 0.4 rg 440 ${pY} Td (${escapePdfText((exp.brand || "-").slice(0, 10))}) Tj ET`);
        pageLines.push(`BT /F1 7 Tf 0.3 0.3 0.4 rg 510 ${pY} Td (${escapePdfText((exp.expenseType || "variable").slice(0, 9))}) Tj ET`);

        pY -= 16;
      });
    }

    // On the final continuation page, render Grand Total Summary Box!
    if (pageNum === totalPages) {
      pageLines.push(fillRoundedRect("0.06 0.09 0.16", 20, 60, 555, 30, 4));
      pageLines.push(`BT /F2 9 Tf 1 1 1 rg 30 72 Td (GRAND TOTAL OPERATIONAL EXPENDITURE) Tj ET`);
      pageLines.push(`BT /F2 10 Tf 0.2 0.8 0.6 rg 325 72 Td (Rs.${fmt(totalAmount)}) Tj ET`);
      pageLines.push(`BT /F1 7.5 Tf 0.8 0.8 0.9 rg 440 72 Td (${totalCount} Total Transactions) Tj ET`);
    }

    // Footer
    pageLines.push(fillRoundedRect("0.82 0.82 0.85", 20, 35, 555, 1, 0));
    pageLines.push(`BT /F1 7 Tf 0.5 0.5 0.5 rg 22 22 Td (CoachFlow ERP  \xb7  Operational Expense Report  \xb7  Confidential) Tj ET`);
    pageLines.push(`BT /F1 7 Tf 0.5 0.5 0.5 rg 488 22 Td (Page ${pageNum} of ${totalPages}) Tj ET`);

    pageStreams.push(pageLines.join("\n"));
  }

  // ── Assemble Dynamic PDF Objects ──
  const objects: string[] = [];

  // Obj 1: Catalog
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);

  // Obj 2: Pages list
  const pageObjectIds: number[] = [];
  for (let i = 0; i < pageStreams.length; i++) {
    pageObjectIds.push(3 + i);
  }
  const kidsStr = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pageStreams.length} >>\nendobj`);

  // Font object IDs
  const font1ObjId = 3 + pageStreams.length;
  const font2ObjId = 4 + pageStreams.length;

  // Create Page Objects (3 .. 3 + pageStreams.length - 1)
  const contentObjIds: number[] = [];
  for (let i = 0; i < pageStreams.length; i++) {
    const pageId = 3 + i;
    const contentId = 5 + pageStreams.length + i;
    contentObjIds.push(contentId);
    objects.push(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font1ObjId} 0 R /F2 ${font2ObjId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj`);
  }

  // Font objects
  objects.push(`${font1ObjId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
  objects.push(`${font2ObjId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);

  // Stream objects
  for (let i = 0; i < pageStreams.length; i++) {
    const contentId = contentObjIds[i];
    const streamText = pageStreams[i];
    objects.push(`${contentId} 0 obj\n<< /Length ${Buffer.byteLength(streamText)} >>\nstream\n${streamText}\nendstream\nendobj`);
  }

  let headerStr = "%PDF-1.4\n";
  let bodyStr = "";
  let xrefStr = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  let offsetVal = Buffer.byteLength(headerStr);

  for (let i = 0; i < objects.length; i++) {
    const objStr = objects[i] + "\n";
    xrefStr += `${String(offsetVal).padStart(10, "0")} 00000 n \n`;
    bodyStr += objStr;
    offsetVal += Buffer.byteLength(objStr);
  }

  return Buffer.from(headerStr + bodyStr + xrefStr + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offsetVal}\n%%EOF\n`, "utf-8");
}
