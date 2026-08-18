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

function buildMultiPagePdfBuffer(pageStreamTexts: string[]): Buffer {
  const pageCount = Math.max(1, pageStreamTexts.length);
  const objects: string[] = [];

  const catalogObjNum = 1;
  const pagesObjNum = 2;
  const firstPageObjNum = 3;
  const font1ObjNum = firstPageObjNum + pageCount;
  const font2ObjNum = font1ObjNum + 1;
  const firstStreamObjNum = font2ObjNum + 1;

  // 1. Catalog Object
  objects.push(`${catalogObjNum} 0 obj\n<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>\nendobj`);

  // 2. Pages Object
  const kidsStr = Array.from({ length: pageCount }, (_, i) => `${firstPageObjNum + i} 0 R`).join(" ");
  objects.push(`${pagesObjNum} 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${pageCount} >>\nendobj`);

  // 3..2+pageCount: Individual Page Objects
  for (let i = 0; i < pageCount; i++) {
    const pageObjNum = firstPageObjNum + i;
    const streamObjNum = firstStreamObjNum + i;
    objects.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font1ObjNum} 0 R /F2 ${font2ObjNum} 0 R >> >> /Contents ${streamObjNum} 0 R >>\nendobj`
    );
  }

  // 4. Fonts
  objects.push(`${font1ObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
  objects.push(`${font2ObjNum} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj`);

  // 5. Content Streams
  for (let i = 0; i < pageCount; i++) {
    const streamObjNum = firstStreamObjNum + i;
    const streamText = pageStreamTexts[i] || "";
    objects.push(`${streamObjNum} 0 obj\n<< /Length ${Buffer.byteLength(streamText)} >>\nstream\n${streamText}\nendstream\nendobj`);
  }

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

  return Buffer.from(
    header + body + xref + `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjNum} 0 R >>\nstartxref\n${offset}\n%%EOF\n`,
    "utf-8"
  );
}

function buildEnhancedBiReportPdfBuffer(data: DailyBiReportData): Buffer {
  const dateStr = escapePdfText(data.dateStr || new Date().toLocaleDateString("en-IN"));
  const genAtStr = escapePdfText(data.generatedAtStr || "");

  const fmt = (n: number) => Math.round(n || 0).toLocaleString("en-IN");

  const brandReports = data.brandDailyReports && data.brandDailyReports.length > 0
    ? data.brandDailyReports
    : (data.brandPerformance && data.brandPerformance.length > 0
      ? data.brandPerformance.map((bp) => ({
          brandName: bp.brandName,
          brandCode: bp.brandName.replace(/[^A-Z0-9]/g, "_"),
          brandInitials: bp.brandName.split(/\s+/).map((w: string) => w[0]).join("").slice(0, 3) || "BM",
          todayLeads: bp.totalLeads,
          todayWalkins: Math.round(bp.totalLeads * 0.4),
          todayAdmissions: bp.admissions,
          todayCollections: bp.dailyCollections,
          todayAdmissionRevenue: bp.admissions * 25000,
          todayFollowups: bp.followupsDone,
          conversionRate: bp.conversionRate,
          last7Days: [],
          sevenDaysTotals: {
            leads: bp.totalLeads,
            walkins: Math.round(bp.totalLeads * 0.4),
            admissions: bp.admissions,
            collections: bp.dailyCollections,
            revenue: bp.admissions * 25000,
            conversionRate: bp.conversionRate,
          },
          todayAdmissionsList: [],
        }))
      : [
          {
            brandName: "CADD MANTRA",
            brandCode: "CADD_MANTRA",
            brandInitials: "CM",
            todayLeads: data.executiveSummary?.totalLeads?.value || 0,
            todayWalkins: 0,
            todayAdmissions: data.executiveSummary?.admissions?.value || 0,
            todayCollections: data.executiveSummary?.totalCollections?.value || 0,
            todayAdmissionRevenue: data.executiveSummary?.totalRevenue?.value || 0,
            todayFollowups: data.executiveSummary?.totalFollowupsDone?.value || 0,
            conversionRate: data.executiveSummary?.conversionRate?.value || 0,
            last7Days: [],
            sevenDaysTotals: {
              leads: 0,
              walkins: 0,
              admissions: 0,
              collections: 0,
              revenue: 0,
              conversionRate: 0,
            },
            todayAdmissionsList: [],
          },
        ]);

  const totalPages = brandReports.length;
  const pageStreamTexts: string[] = [];

  const brandColorPalettes = [
    { dark: "0.08 0.12 0.28", topStrip: "0.29 0.00 0.51", badgeBg: "0.38 0.18 0.88", accent: "0.48 0.22 0.93" },
    { dark: "0.04 0.18 0.20", topStrip: "0.02 0.59 0.41", badgeBg: "0.05 0.65 0.50", accent: "0.02 0.59 0.41" },
    { dark: "0.06 0.14 0.28", topStrip: "0.02 0.45 0.75", badgeBg: "0.10 0.55 0.90", accent: "0.02 0.52 0.78" },
    { dark: "0.14 0.08 0.25", topStrip: "0.48 0.15 0.70", badgeBg: "0.58 0.20 0.85", accent: "0.85 0.45 0.05" },
  ];

  const renderBrandKpiBox = (
    x: number,
    y: number,
    w: number,
    h: number,
    accentCol: string,
    label: string,
    value: string,
    badgeText: string
  ): string[] => {
    return [
      fillRoundedRect("0.98 0.99 1.0", x, y, w, h, 6),
      strokeRoundedRect("0.88 0.90 0.95", x, y, w, h, 6),
      fillRoundedRect(accentCol, x, y + h - 3, w, 3, 2),
      `BT /F2 6.5 Tf 0.35 0.40 0.50 rg ${x + 6} ${y + h - 14} Td (${escapePdfText(label)}) Tj ET`,
      `BT /F2 10.5 Tf 0.08 0.10 0.22 rg ${x + 6} ${y + h - 28} Td (${escapePdfText(value)}) Tj ET`,
      fillRoundedRect(accentCol, x + 6, y + 6, Math.min(94, w - 12), 11, 2),
      `BT /F2 5.5 Tf 1 1 1 rg ${x + 10} ${y + 9.5} Td (${escapePdfText(badgeText)}) Tj ET`,
    ];
  };

  brandReports.forEach((brand, bIdx) => {
    const pageLines: string[] = [];
    const pal = brandColorPalettes[bIdx % brandColorPalettes.length];
    const bName = escapePdfText(brand.brandName || `Brand ${bIdx + 1}`);
    const bCode = escapePdfText(brand.brandCode || `BRD_${bIdx + 1}`);
    const bInitials = escapePdfText(brand.brandInitials || "BM");

    // ── 1. Top Executive Header Banner (Y: 765..822) ──
    pageLines.push(fillRoundedRect(pal.dark, 20, 765, 555, 57, 8));
    pageLines.push(fillRoundedRect(pal.topStrip, 20, 816, 555, 6, 4));
    pageLines.push(`BT /F2 13 Tf 1 1 1 rg 35 798 Td (COACHFLOW ERP  \xb7  DAILY EXECUTIVE BRAND REPORT) Tj ET`);
    pageLines.push(
      `BT /F1 7.5 Tf 0.80 0.88 0.98 rg 35 780 Td (Date: ${dateStr}   |   Brand ${bIdx + 1} of ${totalPages}: ${bName}   |   Generated: ${genAtStr} IST) Tj ET`
    );

    // ── 2. Brand Identity & Logo Card (Y: 708..754) ──
    pageLines.push(fillRoundedRect("0.97 0.98 1.0", 20, 708, 555, 46, 6));
    pageLines.push(strokeRoundedRect("0.86 0.89 0.95", 20, 708, 555, 46, 6));

    // Monogram / Logo Badge
    pageLines.push(fillRoundedRect(pal.badgeBg, 30, 714, 34, 34, 6));
    pageLines.push(`BT /F2 13 Tf 1 1 1 rg 38 726 Td (${bInitials}) Tj ET`);

    pageLines.push(`BT /F2 13 Tf 0.08 0.12 0.25 rg 74 732 Td (${bName}) Tj ET`);
    pageLines.push(
      `BT /F1 7 Tf 0.35 0.40 0.50 rg 74 718 Td (Operational Training Brand  \xb7  Code: ${bCode}  \xb7  Daily Status: Active) Tj ET`
    );

    pageLines.push(fillRoundedRect("0.02 0.59 0.41", 450, 720, 115, 20, 4));
    pageLines.push(`BT /F2 7.5 Tf 1 1 1 rg 460 726 Td (DAILY PERFORMANCE SNAPSHOT) Tj ET`);

    // ── 3. Today's 5 Core KPI Metric Cards (Y: 642..696) ──
    const kpiW = 104;
    const kpiH = 54;
    const gap = 8.75;
    const kpiY = 642;

    // Card 1: Leads Today
    pageLines.push(
      ...renderBrandKpiBox(
        20,
        kpiY,
        kpiW,
        kpiH,
        "0.48 0.22 0.93",
        "LEADS TODAY",
        `${brand.todayLeads} Enquiries`,
        `${brand.conversionRate}% Conv. Rate`
      )
    );

    // Card 2: Walk-ins Today
    pageLines.push(
      ...renderBrandKpiBox(
        20 + (kpiW + gap),
        kpiY,
        kpiW,
        kpiH,
        "0.85 0.45 0.05",
        "WALK-INS TODAY",
        `${brand.todayWalkins} Walk-ins`,
        "Direct Campus Visits"
      )
    );

    // Card 3: Admissions Today
    pageLines.push(
      ...renderBrandKpiBox(
        20 + (kpiW + gap) * 2,
        kpiY,
        kpiW,
        kpiH,
        "0.02 0.52 0.78",
        "ADMISSIONS TODAY",
        `${brand.todayAdmissions} Confirmed`,
        "Enrolled Students"
      )
    );

    // Card 4: Collections Today
    pageLines.push(
      ...renderBrandKpiBox(
        20 + (kpiW + gap) * 3,
        kpiY,
        kpiW,
        kpiH,
        "0.02 0.59 0.41",
        "TOTAL COLLECTIONS",
        `Rs.${fmt(brand.todayCollections)}`,
        "Cash / UPI / Bank"
      )
    );

    // Card 5: Admission Revenue Today
    pageLines.push(
      ...renderBrandKpiBox(
        20 + (kpiW + gap) * 4,
        kpiY,
        kpiW,
        kpiH,
        "0.88 0.17 0.24",
        "ADMISSION REVENUE",
        `Rs.${fmt(brand.todayAdmissionRevenue)}`,
        "Total Package Value"
      )
    );

    // ── 4. Section 1: 7-Day Performance Comparison Matrix (Y: 480..626) ──
    pageLines.push(
      `BT /F2 8.5 Tf 0.29 0.0 0.51 rg 22 626 Td (1. LAST 7 DAYS PERFORMANCE COMPARISON  \xb7  DAILY RUN-RATE & VELOCITY TREND) Tj ET`
    );

    const tblHdrY = 606;
    pageLines.push(fillRoundedRect("0.12 0.18 0.38", 20, tblHdrY, 555, 17, 3));
    const tCols = [
      { x: 28, label: "Date / Day" },
      { x: 130, label: "Total Leads" },
      { x: 205, label: "Walk-ins" },
      { x: 275, label: "Admissions" },
      { x: 350, label: "Collections (Rs.)" },
      { x: 445, label: "Admission Rev (Rs.)" },
      { x: 535, label: "Conv. %" },
    ];
    tCols.forEach((c) => {
      pageLines.push(`BT /F2 6.5 Tf 1 1 1 rg ${c.x} ${tblHdrY + 5} Td (${escapePdfText(c.label)}) Tj ET`);
    });

    let tRowY = 590;
    const historyList = brand.last7Days && brand.last7Days.length > 0 ? brand.last7Days : [];

    if (historyList.length === 0) {
      pageLines.push(fillRoundedRect("0.97 0.98 1.0", 20, tRowY - 2, 555, 16, 0));
      pageLines.push(`BT /F1 7 Tf 0.4 0.4 0.5 rg 180 ${tRowY + 3} Td (No historical metrics recorded for the past 7 days.) Tj ET`);
      tRowY -= 18;
    } else {
      historyList.forEach((row, rIdx) => {
        const isToday = row.date.includes("Today");
        const rowBg = isToday ? "0.92 0.96 1.0" : rIdx % 2 === 0 ? "0.96 0.97 0.99" : "1 1 1";
        pageLines.push(fillRoundedRect(rowBg, 20, tRowY - 2, 555, 14, 0));

        const font = isToday ? "/F2" : "/F1";
        const primaryColor = isToday ? "0.08 0.12 0.28" : "0.20 0.22 0.30";

        pageLines.push(`BT ${font} 6.5 Tf ${primaryColor} rg 28 ${tRowY + 2.5} Td (${escapePdfText(row.date)}) Tj ET`);
        pageLines.push(`BT ${font} 6.5 Tf ${primaryColor} rg 135 ${tRowY + 2.5} Td (${row.leads}) Tj ET`);
        pageLines.push(`BT ${font} 6.5 Tf ${primaryColor} rg 210 ${tRowY + 2.5} Td (${row.walkins}) Tj ET`);
        pageLines.push(`BT /F2 6.5 Tf ${isToday ? "0.02 0.52 0.78" : primaryColor} rg 280 ${tRowY + 2.5} Td (${row.admissions}) Tj ET`);
        pageLines.push(`BT /F2 6.5 Tf 0.02 0.59 0.41 rg 350 ${tRowY + 2.5} Td (Rs.${fmt(row.collections)}) Tj ET`);
        pageLines.push(`BT ${font} 6.5 Tf 0.88 0.17 0.24 rg 445 ${tRowY + 2.5} Td (Rs.${fmt(row.revenue)}) Tj ET`);
        pageLines.push(`BT ${font} 6.5 Tf ${primaryColor} rg 535 ${tRowY + 2.5} Td (${row.conversionRate}%) Tj ET`);

        tRowY -= 15;
      });

      // Summary / 7-Day Total Row
      const sTotals = brand.sevenDaysTotals || { leads: 0, walkins: 0, admissions: 0, collections: 0, revenue: 0, conversionRate: 0 };
      pageLines.push(fillRoundedRect("0.89 0.92 0.98", 20, tRowY - 2, 555, 16, 2));
      pageLines.push(`BT /F2 7 Tf 0.12 0.18 0.38 rg 28 ${tRowY + 3} Td (7-DAY TOTAL / AVG) Tj ET`);
      pageLines.push(`BT /F2 7 Tf 0.12 0.18 0.38 rg 130 ${tRowY + 3} Td (${sTotals.leads} (Avg ${(sTotals.leads / 7).toFixed(1)})) Tj ET`);
      pageLines.push(`BT /F2 7 Tf 0.12 0.18 0.38 rg 205 ${tRowY + 3} Td (${sTotals.walkins} (Avg ${(sTotals.walkins / 7).toFixed(1)})) Tj ET`);
      pageLines.push(`BT /F2 7 Tf 0.12 0.18 0.38 rg 275 ${tRowY + 3} Td (${sTotals.admissions} (Avg ${(sTotals.admissions / 7).toFixed(1)})) Tj ET`);
      pageLines.push(`BT /F2 7 Tf 0.02 0.59 0.41 rg 350 ${tRowY + 3} Td (Rs.${fmt(sTotals.collections)}) Tj ET`);
      pageLines.push(`BT /F2 7 Tf 0.88 0.17 0.24 rg 445 ${tRowY + 3} Td (Rs.${fmt(sTotals.revenue)}) Tj ET`);
      pageLines.push(`BT /F2 7 Tf 0.12 0.18 0.38 rg 535 ${tRowY + 3} Td (${sTotals.conversionRate}%) Tj ET`);
    }

    // ── 5. Section 2: Admissions Converted Today (with Lead Registration Date) (Y: 65..468) ──
    pageLines.push(
      `BT /F2 8.5 Tf 0.29 0.0 0.51 rg 22 468 Td (2. ADMISSIONS CONVERTED TODAY  \xb7  1ST LEAD REGISTRATION & CONVERSION AUDIT) Tj ET`
    );

    const aHdrY = 448;
    pageLines.push(fillRoundedRect("0.12 0.18 0.38", 20, aHdrY, 555, 17, 3));
    const aCols = [
      { x: 26, label: "#" },
      { x: 42, label: "Student Name" },
      { x: 155, label: "Enrolled Course" },
      { x: 275, label: "1st Lead Date" },
      { x: 365, label: "Converted Date" },
      { x: 450, label: "Turnaround" },
      { x: 512, label: "Course Fee / Paid" },
    ];
    aCols.forEach((c) => {
      pageLines.push(`BT /F2 6.5 Tf 1 1 1 rg ${c.x} ${aHdrY + 5} Td (${escapePdfText(c.label)}) Tj ET`);
    });

    let aRowY = 430;
    const todayAdmList = brand.todayAdmissionsList || [];

    if (todayAdmList.length === 0) {
      pageLines.push(fillRoundedRect("0.97 0.98 1.0", 20, 360, 555, 68, 6));
      pageLines.push(strokeRoundedRect("0.88 0.90 0.95", 20, 360, 555, 68, 6));
      pageLines.push(`BT /F2 9 Tf 0.20 0.25 0.35 rg 150 405 Td (No student admissions converted today for ${bName}.) Tj ET`);
      pageLines.push(
        `BT /F1 7.5 Tf 0.40 0.45 0.55 rg 125 388 Td (Active lead pipeline has ${brand.todayLeads} new enquiries today with ${brand.todayFollowups} follow-up touches logged.) Tj ET`
      );
      pageLines.push(
        `BT /F2 7.5 Tf 0.02 0.59 0.41 rg 195 372 Td (Focus team outreach on high-intent leads to drive next conversion.) Tj ET`
      );
    } else {
      const maxRows = 16;
      todayAdmList.slice(0, maxRows).forEach((adm, aIdx) => {
        const rowBg = aIdx % 2 === 0 ? "0.96 0.97 0.99" : "1 1 1";
        pageLines.push(fillRoundedRect(rowBg, 20, aRowY - 2, 555, 18, 0));

        pageLines.push(`BT /F1 6.5 Tf 0.3 0.3 0.4 rg 26 ${aRowY + 4} Td (${aIdx + 1}) Tj ET`);
        pageLines.push(
          `BT /F2 6.5 Tf 0.08 0.12 0.22 rg 42 ${aRowY + 4} Td (${escapePdfText((adm.studentName || "Student").slice(0, 18))}) Tj ET`
        );
        pageLines.push(
          `BT /F1 6.5 Tf 0.25 0.28 0.35 rg 155 ${aRowY + 4} Td (${escapePdfText((adm.courseName || "General").slice(0, 20))}) Tj ET`
        );
        pageLines.push(
          `BT /F1 6.5 Tf 0.35 0.40 0.50 rg 275 ${aRowY + 4} Td (${escapePdfText(adm.leadRegistrationDate || "Direct")}) Tj ET`
        );
        pageLines.push(
          `BT /F2 6.5 Tf 0.10 0.12 0.22 rg 365 ${aRowY + 4} Td (${escapePdfText(adm.admissionDate || "Today")}) Tj ET`
        );

        // Turnaround Badge
        const tat = adm.turnaroundDays || "Same Day";
        const tatCol = tat.toLowerCase().includes("same")
          ? "0.02 0.59 0.41"
          : tat.includes("1") || tat.includes("2") || tat.includes("3") || tat.includes("4") || tat.includes("5") || tat.includes("6") || tat.includes("7")
          ? "0.14 0.38 0.92"
          : "0.85 0.45 0.05";
        pageLines.push(fillRoundedRect(tatCol, 448, aRowY + 1, 55, 12, 2));
        pageLines.push(`BT /F2 5.5 Tf 1 1 1 rg 452 ${aRowY + 4.5} Td (${escapePdfText(tat.slice(0, 13))}) Tj ET`);

        pageLines.push(
          `BT /F2 6.5 Tf 0.02 0.59 0.41 rg 512 ${aRowY + 4} Td (Rs.${fmt(adm.totalCourseFee)} / ${fmt(adm.amountReceivedToday)}) Tj ET`
        );

        aRowY -= 20;
      });
    }

    // ── 6. Page Footer (Y: 35..50) ──
    pageLines.push(fillRoundedRect("0.82 0.82 0.85", 20, 50, 555, 1, 0));
    pageLines.push(
      `BT /F1 7 Tf 0.45 0.45 0.50 rg 22 38 Td (CoachFlow ERP  \xb7  Multi-Brand Executive Daily BI Report  \xb7  Confidential) Tj ET`
    );
    pageLines.push(`BT /F1 7 Tf 0.45 0.45 0.50 rg 460 38 Td (Brand Page ${bIdx + 1} of ${totalPages}) Tj ET`);

    pageStreamTexts.push(pageLines.join("\n"));
  });

  return buildMultiPagePdfBuffer(pageStreamTexts);
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
