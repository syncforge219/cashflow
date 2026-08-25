import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Quotation from "@/models/Quotation";
import QuotationProfile from "@/models/QuotationProfile";
import { numberToIndianWords } from "@/lib/numberToWords";

function generateQuotationHtml(quotation: any, profile: any): string {
  const dateStr = quotation.date
    ? new Date(quotation.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";

  const companyName = quotation.companyName || profile?.name || "AARAM PLASTICS PVT. LTD.";
  const gstin = quotation.companyGstin || profile?.gstin || "08AABCA5691D1ZS";
  const cin = quotation.companyCin || profile?.cin || "U25209RJ1996PTC011513";
  const description = quotation.companyDescription || profile?.description || "Manufacturers of : ISI MARKED 'GANGOTRI' HDPE PIPES, SPRINKLER SYSTEM AND PLB TELECOM DUCTS";
  const address = quotation.companyAddress || profile?.address || "101, Vinayak Complex, Station Road, JAIPUR - 302 001 (Raj.)";
  const phone = quotation.companyPhone || profile?.phone || "0141-4059826";
  const telefax = profile?.telefax || "0141-2370336";
  const email = quotation.companyEmail || profile?.email || "appl_jaipur@rediffmail.com";
  const website = quotation.companyWebsite || profile?.website || "www.aaramplastics.com";
  const worksAddress = quotation.companyWorksAddress || profile?.worksAddress || "G-232, Sitapura Ind. Area, Tonk Road, JAIPUR - 302 022 (Raj.) Tel. : 0141-2771862";
  const isoTag = profile?.isoTag || "";

  const bankDetails = quotation.bankDetails || profile?.bankDetails || {
    bankName: "STATE BANK OF INDIA",
    branch: "SITAPURA IND. AREA JAIPUR",
    accountNumber: "61330464677",
    ifsc: "SBIN0031792",
    rtgsCode: "SBIN0031792",
  };

  const terms = quotation.termsAndConditions && quotation.termsAndConditions.length > 0
    ? quotation.termsAndConditions
    : profile?.defaultTerms || [
        "GST CHARGE EXTRA",
        "TRANSPORTATION INCLUDED",
        "PAYMENT ADVANCE",
        "ALL PIPE 6MTR LENGTH",
        "MATERIAL DELIVERD WITHIN 7DAYS",
      ];

  const parseItemQty = (item: any): { qtyNum: number; displayQty: string } => {
    const q = item.quantity;
    const r = Number(item.rate) || 0;
    const storedAmt = Number(item.amount) || 0;

    // 1. If quantity field has explicit user input (e.g. "2 days", "2")
    if (q !== undefined && q !== null && String(q).trim() !== "" && String(q).trim() !== "0") {
      const str = String(q).trim();
      const match = str.toLowerCase().match(/[\d.]+/);
      const num = match ? parseFloat(match[0]) : 1;
      return { qtyNum: num > 0 ? num : 1, displayQty: str };
    }

    // 2. If valid number > 0 in quantity
    if (typeof q === "number" && q > 0) {
      return { qtyNum: q, displayQty: String(q) };
    }

    // 3. Fallback: Parse quantity from description or name (e.g. "Two days...", "2 days...")
    const combinedText = `${item.name || ""} ${item.description || ""}`.toLowerCase();
    
    const digitPattern = combinedText.match(/(\d+)\s*(day|days|hour|hours|month|months|year|years|seat|seats|unit|units|pc|pcs|kg|mtr)/);
    if (digitPattern && parseFloat(digitPattern[1]) > 0) {
      const num = parseFloat(digitPattern[1]);
      const unitW = digitPattern[2];
      return { qtyNum: num, displayQty: `${num} ${unitW}` };
    }

    const wordMap: Record<string, number> = {
      "ten": 10, "nine": 9, "eight": 8, "seven": 7, "six": 6, "five": 5,
      "four": 4, "three": 3, "two": 2, "one": 1, "double": 2, "single": 1
    };
    for (const [w, n] of Object.entries(wordMap)) {
      const regex = new RegExp(`\\b${w}\\b`, "i");
      if (regex.test(combinedText)) {
        return { qtyNum: n, displayQty: `${n} days` };
      }
    }

    // 4. If storedAmt > 0 and rate > 0
    if (storedAmt > 0 && r > 0) {
      const derived = Math.round(storedAmt / r);
      return { qtyNum: derived, displayQty: String(derived) };
    }

    // 5. Default fallback if rate > 0
    if (r > 0) {
      return { qtyNum: 1, displayQty: "1" };
    }

    return { qtyNum: 0, displayQty: "0" };
  };

  const items = quotation.items || [];
  const gstRate = quotation.gstRate !== undefined && quotation.gstRate !== null ? Number(quotation.gstRate) : 18;

  const calculatedSubtotal = items.reduce((sum: number, it: any) => {
    const { qtyNum } = parseItemQty(it);
    const r = Number(it.rate) || 0;
    const a = Number(it.amount) > 0 ? Number(it.amount) : qtyNum * r;
    return sum + a;
  }, 0);

  const subtotal = (Number(quotation.subtotal) > 0 && calculatedSubtotal === 0)
    ? Number(quotation.subtotal)
    : calculatedSubtotal;
  const gstAmount = Math.round((subtotal * gstRate) / 100);
  const transportText = quotation.transportText || (quotation.transportCharges ? `₹${quotation.transportCharges}` : "included");
  const grandTotal = Math.round(subtotal + gstAmount + Number(quotation.transportCharges || 0));
  const amountWords = numberToIndianWords(grandTotal);

  const category = quotation.category || "PRODUCT";
  const isPhysicalGoods = category === "PRODUCT";
  const billingCycle = quotation.billingCycle || "ONE_TIME";
  const contractPeriod = quotation.contractPeriod || "";

  let categoryTitle = "QUOTATION";
  let descColHeader = "Description of Goods";
  let qtyColHeader = "Qty / Duration";
  let rateColHeader = "Rate per Unit";

  if (category === "SOFTWARE") {
    categoryTitle = "SOFTWARE & SAAS QUOTATION";
    descColHeader = "Description of Software / License";
    qtyColHeader = "Qty / Duration";
    rateColHeader = "Rate per Unit/Mo";
  } else if (category === "DIGITAL_MARKETING") {
    categoryTitle = "DIGITAL MARKETING PROPOSAL & QUOTATION";
    descColHeader = "Description of Marketing Deliverables";
    qtyColHeader = "Qty / Duration";
    rateColHeader = "Rate per Period";
  } else if (category === "SERVICE") {
    categoryTitle = "SERVICE & MAINTENANCE QUOTATION";
    descColHeader = "Description of Services / Scope of Work";
    qtyColHeader = "Qty / Duration";
    rateColHeader = "Rate per Unit";
  }

  const firstUnit = items.find((i: any) => i.unit && i.unit.trim())?.unit?.trim();
  if (firstUnit) {
    if (firstUnit.toLowerCase().startsWith("per ")) {
      rateColHeader = `Rate ${firstUnit}`;
    } else {
      rateColHeader = `Rate per ${firstUnit}`;
    }
  }

  const cycleDisplayMap: Record<string, string> = {
    ONE_TIME: "One-Time",
    MONTHLY: "Monthly Recurring",
    QUARTERLY: "Quarterly Billing",
    HALF_YEARLY: "Half-Yearly Billing",
    YEARLY: "Yearly / Annual Contract",
    CUSTOM: "Custom Billing",
  };
  const cycleLabel = cycleDisplayMap[billingCycle] || billingCycle;

  // Minimum rows for clean A4 printing layout
  const minRows = 12;
  const emptyRowsCount = Math.max(0, minRows - items.length);
  const emptyRows = Array.from({ length: emptyRowsCount });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${categoryTitle} - ${quotation.quotationNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: Arial, Helvetica, sans-serif;
    }
    body {
      background: #ffffff;
      color: #000000;
      font-size: 11px;
      line-height: 1.3;
      padding: 10px;
    }
    .page-container {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      border: 2px solid #000;
      padding: 10px;
      position: relative;
      background: #fff;
    }
    
    /* Header Section */
    .top-bar {
      margin-bottom: 4px;
    }
    .gstin-box {
      font-weight: bold;
      font-size: 11px;
      text-align: right;
      margin-bottom: 2px;
    }
    .header-main-flex {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      min-height: 70px;
      margin-bottom: 6px;
    }
    .header-left {
      flex: 0 0 130px;
      display: flex;
      justify-content: flex-start;
      align-items: center;
    }
    .header-center {
      flex: 1;
      text-align: center;
      padding: 0 10px;
    }
    .header-right {
      flex: 0 0 130px;
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }
    .header-logo-img {
      height: 65px;
      max-height: 75px;
      max-width: 130px;
      object-fit: contain;
    }
    .company-title {
      font-size: 24px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: -0.5px;
      color: #1a237e;
      text-align: center;
      line-height: 1.2;
    }

    .mfr-banner {
      background: #1a237e;
      color: #ffffff;
      text-align: center;
      font-weight: bold;
      font-size: 9.5px;
      padding: 3px 6px;
      border-radius: 3px;
      margin-bottom: 4px;
    }

    .address-line {
      text-align: center;
      font-size: 9.5px;
      margin-bottom: 8px;
      color: #222;
    }

    .doc-title {
      text-align: center;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin: 6px 0 6px 0;
      border-bottom: 1px solid #000;
      padding-bottom: 4px;
    }

    .category-badge-bar {
      display: flex;
      justify-content: space-between;
      background: #f0f4ff;
      border: 1px solid #1a237e;
      padding: 4px 8px;
      font-size: 9.5px;
      font-weight: bold;
      margin-bottom: 6px;
    }

    /* Meta Table (PO, Consignee, Delivery) */
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: -1px;
    }
    .meta-table td {
      border: 1px solid #000;
      padding: 5px 8px;
      vertical-align: top;
    }
    .meta-label {
      font-weight: bold;
    }

    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: -1px;
    }
    .items-table th, .items-table td {
      border: 1px solid #000;
      padding: 5px 6px;
      font-size: 10.5px;
    }
    .items-table th {
      background-color: #f2f2f2;
      font-weight: bold;
      text-align: center;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }

    /* Totals & Words */
    .summary-row {
      font-weight: bold;
    }

    .words-box {
      border: 1px solid #000;
      padding: 6px 8px;
      font-weight: bold;
      margin-top: -1px;
      background: #fafafa;
    }

    /* Terms & Signature Section */
    .bottom-section {
      display: flex;
      justify-content: space-between;
      border: 1px solid #000;
      margin-top: -1px;
      min-height: 120px;
    }
    .terms-col {
      width: 60%;
      border-right: 1px solid #000;
      padding: 8px;
      font-size: 9.5px;
    }
    .terms-col ol {
      padding-left: 16px;
    }
    .terms-col li {
      margin-bottom: 3px;
    }
    .sig-col {
      width: 40%;
      padding: 8px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      position: relative;
    }
    .sig-company {
      font-weight: bold;
      font-size: 10px;
      text-transform: uppercase;
    }
    .stamp-container {
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stamp-img {
      max-height: 55px;
      object-fit: contain;
    }
    .sig-title {
      font-weight: bold;
      font-size: 10px;
      text-transform: uppercase;
      border-top: 1px dashed #666;
      padding-top: 3px;
    }

    /* Bank Footer */
    .bank-box {
      border: 1px solid #000;
      margin-top: -1px;
      padding: 6px 8px;
      font-size: 10px;
    }
    .bank-flex {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .bank-grid {
      display: grid;
      grid-template-columns: 110px 1fr;
      row-gap: 2px;
      flex: 1;
    }
    .bank-label { font-weight: bold; }
    .bank-qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-left: 12px;
      padding-left: 12px;
      border-left: 1px dashed #000;
    }
    .bank-qr-img {
      width: 120px;
      height: 120px;
      max-height: 125px;
      max-width: 125px;
      object-fit: contain;
      border: 1px solid #000;
      padding: 3px;
      background: #fff;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      image-rendering: pixelated;
    }
    .bank-qr-label {
      font-size: 8.5px;
      font-weight: bold;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Computer Generated Note */
    .computer-note {
      text-align: center;
      font-size: 9.5px;
      font-weight: bold;
      font-style: italic;
      color: #333;
      margin-top: 8px;
      margin-bottom: 4px;
    }

    /* Footer Bar */
    .footer-bar {
      margin-top: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 9px;
      border-top: 1px solid #000;
      padding-top: 5px;
    }
    .iso-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: bold;
    }

    @media print {
      body { padding: 0; }
      .page-container { border: none; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 15px; text-align: center;">
    <button onclick="window.print()" style="background: #1a237e; color: white; border: none; padding: 10px 24px; font-size: 14px; font-weight: bold; border-radius: 6px; cursor: pointer; shadow: 0 2px 4px rgba(0,0,0,0.2);">
      🖨️ Print / Save as PDF
    </button>
  </div>

  <div class="page-container">
    <!-- Top Header -->
    <div class="top-bar">
      <div class="gstin-box">
        GSTIN : ${gstin}
      </div>
      <div class="header-main-flex">
        <div class="header-left">
          ${profile?.logo ? `<img src="${profile.logo}" alt="Company Logo" class="header-logo-img" />` : `
            <svg width="55" height="55" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="50,10 90,90 10,90" fill="#1a237e" stroke="#000" stroke-width="3"/>
              <text x="50" y="70" font-size="28" font-weight="bold" fill="#fff" text-anchor="middle">A</text>
            </svg>
          `}
        </div>
        <div class="header-center">
          <div class="company-title">${companyName}</div>
        </div>
        <div class="header-right">
          ${profile?.brandLogo ? `<img src="${profile.brandLogo}" alt="Brand Logo" class="header-logo-img" />` : `<div style="width: 55px;"></div>`}
        </div>
      </div>
    </div>

    <div class="address-line">
      <b>Admin. Office :</b> ${address} | <b>Tel. :</b> ${phone} | <b>Telefax :</b> ${telefax}<br/>
      <b>Visit us :</b> ${website} | <b>E-mail :</b> ${email}<br/>
      <b>CIN :</b> ${cin}
    </div>

    <div class="doc-title">${categoryTitle}</div>

    <div class="category-badge-bar">
      <div><span>CATEGORY:</span> ${category.replace("_", " ")}</div>
      <div><span>BILLING FREQUENCY:</span> ${cycleLabel.toUpperCase()}</div>
      ${contractPeriod ? `<div><span>CONTRACT PERIOD:</span> ${contractPeriod}</div>` : ""}
    </div>

    <!-- Meta Details Box -->
    <table class="meta-table">
      <tr>
        <td style="width: 50%;">
          <div><span class="meta-label">QUOTATION NO. :-</span> <b>${quotation.quotationNumber}</b></div>
          <div style="margin-top: 5px;"><span class="meta-label">DATED :-</span> ${dateStr}</div>
        </td>
        <td style="width: 50%;">
          <div><span class="meta-label">Client / Consignee :-</span> <b>${quotation.customerName}</b></div>
          <div style="padding-left: 70px; white-space: pre-line;">${quotation.customerAddress || quotation.consigneeInfo || "-"}</div>
          <div style="margin-top: 6px;"><span class="meta-label">Location / Site :</span> ${quotation.deliveryLocation || "-"}</div>
          <div><span class="meta-label">GSTIN No.</span> ${quotation.customerGstin || "-"}</div>
        </td>
      </tr>
    </table>

    <!-- Product Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 8%;">S.No.</th>
          <th style="width: 44%;">${descColHeader}</th>
          <th style="width: 16%;">${qtyColHeader}</th>
          <th style="width: 16%;">${rateColHeader}</th>
          <th style="width: 16%;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item: any, index: number) => {
          const { qtyNum, displayQty } = parseItemQty(item);
          const rN = Number(item.rate) || 0;
          const amtN = (Number(item.amount) > 0) ? Number(item.amount) : qtyNum * rN;
          return `
          <tr>
            <td class="text-center">${index + 1}</td>
            <td class="text-left font-bold">
              ${item.name}
              ${item.description ? `<div style="font-weight: normal; font-size: 9.5px; color: #444;">${item.description}</div>` : ""}
            </td>
            <td class="text-center">${displayQty}</td>
            <td class="text-center">₹${rN.toLocaleString("en-IN")}</td>
            <td class="text-center">₹${amtN.toLocaleString("en-IN")}</td>
          </tr>
        `;
        }).join("")}

        ${emptyRows.map(() => `
          <tr>
            <td class="text-center">&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
        `).join("")}

        <!-- Summary Totals Rows -->
        <tr class="summary-row">
          <td colspan="4" class="text-right">Subtotal</td>
          <td class="text-center">₹${subtotal.toLocaleString("en-IN")}</td>
        </tr>
        <tr class="summary-row">
          <td colspan="4" class="text-right">GST (${gstRate}%)</td>
          <td class="text-center">₹${gstAmount.toLocaleString("en-IN")}</td>
        </tr>
        ${isPhysicalGoods && (Number(quotation.transportCharges) > 0 || (quotation.transportText && quotation.transportText.trim() !== "")) ? `
        <tr class="summary-row">
          <td colspan="4" class="text-right">Transport / Misc Charges</td>
          <td class="text-center">${quotation.transportText || `₹${Number(quotation.transportCharges || 0).toLocaleString("en-IN")}`}</td>
        </tr>` : ""}
        <tr class="summary-row" style="font-size: 11.5px; background-color: #fafafa;">
          <td colspan="4" class="text-right">Grand Total (${cycleLabel})</td>
          <td class="text-center">₹${grandTotal.toLocaleString("en-IN")}</td>
        </tr>
      </tbody>
    </table>

    <!-- Amount in Words -->
    <div class="words-box">
      Rupees :- ${amountWords}
    </div>

    <!-- Terms & Signature -->
    <div class="bottom-section">
      <div class="terms-col">
        <ol>
          ${terms.map((t: string) => `<li>${t}</li>`).join("")}
        </ol>
      </div>
      <div class="sig-col">
        <div class="sig-company">FOR ${companyName}</div>
        <div class="stamp-container">
          ${profile?.signatureImage ? `<img src="${profile.signatureImage}" class="stamp-img" alt="Signature" />` : `<span style="color: #999; font-size: 9px;">[ OFFICIAL STAMP & SIGN ]</span>`}
        </div>
        <div class="sig-title">${profile?.authorizedSignatory || "AUTHORISED SIGNATORY"}</div>
      </div>
    </div>

    <!-- Bank Details Footer Box -->
    <div class="bank-box">
      <div class="bank-flex">
        <div style="flex: 1;">
          <div style="font-weight: bold; margin-bottom: 3px;">Bank Detail :</div>
          <div class="bank-grid">
            <div class="bank-label">Company Name :</div>
            <div style="font-weight: bold;">${companyName}</div>
            <div class="bank-label">Name of Bank :</div>
            <div>${bankDetails.bankName || "STATE BANK OF INDIA"}</div>
            <div class="bank-label">Branch Address :</div>
            <div>${bankDetails.branch || "SITAPURA IND. AREA JAIPUR"}</div>
            <div class="bank-label">Account No. :</div>
            <div>"${bankDetails.accountNumber || "61330464677"}"</div>
            <div class="bank-label">RTGS Code :</div>
            <div>${bankDetails.rtgsCode || bankDetails.ifsc || "SBIN0031792"}</div>
          </div>
        </div>
        ${profile?.bankQrImage ? `
        <div class="bank-qr-container">
          <img src="${profile.bankQrImage}" class="bank-qr-img" alt="Bank Payment QR Code" />
          <div class="bank-qr-label">Bank Payment QR</div>
        </div>
        ` : ""}
      </div>
    </div>

    <!-- Computer Generated Note -->
    <div class="computer-note">
      This is a computer generated quotation no signature is required
    </div>

    <!-- Footer Bar -->
    <div class="footer-bar">
      <div>Regd. Office & Works : ${worksAddress}</div>
    </div>
  </div>
</body>
</html>`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    const quotation = await Quotation.findById(id).lean();
    if (!quotation) {
      return NextResponse.json({ success: false, error: "Quotation not found" }, { status: 404 });
    }

    const companyId = (quotation as any).companyId || "DEFAULT_COMPANY";
    const profile = await QuotationProfile.findOne({ companyId }).lean();

    const htmlContent = generateQuotationHtml(quotation, profile);

    // Try Puppeteer server-side PDF generation if available
    try {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: "networkidle0" as any });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      });
      await browser.close();

      return new NextResponse(pdfBuffer as any, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="Quotation_${(quotation as any).quotationNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
        },
      });
    } catch (puppeteerErr) {
      console.warn("Puppeteer binary PDF render fallback to HTML print layout:", puppeteerErr);
      return new NextResponse(htmlContent, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }
  } catch (error: any) {
    console.error("Error generating quotation PDF:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
