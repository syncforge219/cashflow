import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PurchaseOrder from "@/models/PurchaseOrder";
import QuotationProfile from "@/models/QuotationProfile";
import { numberToIndianWords } from "@/lib/numberToWords";

function generatePurchaseOrderHtml(po: any, profile: any): string {
  const dateStr = po.date
    ? new Date(po.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";

  const companyName = po.companyName || profile?.name || "AARAM PLASTICS PVT. LTD.";
  const gstin = po.companyGstin || profile?.gstin || "08AABCA5691D1ZS";
  const cin = po.companyCin || profile?.cin || "U25209RJ1996PTC011513";
  const address = po.companyAddress || profile?.address || "101, Vinayak Complex, Station Road, JAIPUR - 302 001 (Raj.)";
  const phone = po.companyPhone || profile?.phone || "0141-4059826";
  const email = po.companyEmail || profile?.email || "appl_jaipur@rediffmail.com";
  const website = po.companyWebsite || profile?.website || "www.aaramplastics.com";
  const worksAddress = po.companyWorksAddress || profile?.worksAddress || "G-232, Sitapura Ind. Area, Tonk Road, JAIPUR - 302 022 (Raj.) Tel. : 0141-2771862";

  const parseItemQty = (item: any): { qtyNum: number; displayQty: string } => {
    const q = item.quantity;
    const r = Number(item.rate) || 0;
    const storedAmt = Number(item.amount) || 0;
    const unit = (item.unit || "").trim();

    const derivedQty = (storedAmt > 0 && r > 0) ? Math.round(storedAmt / r) : 0;

    if (q !== undefined && q !== null && String(q).trim() !== "" && String(q).trim() !== "0") {
      const str = String(q).trim();
      const match = str.toLowerCase().match(/[\d.]+/);
      const parsedNum = match ? parseFloat(match[0]) : 0;
      
      let qtyNum = parsedNum > 0 ? parsedNum : (derivedQty > 0 ? derivedQty : 1);
      let displayQty = str;
      if (/^\d+(\.\d+)?$/.test(str) && unit && !str.toLowerCase().includes(unit.toLowerCase())) {
        displayQty = `${str} ${unit}`;
      }

      return { qtyNum, displayQty };
    }

    if (typeof q === "number" && q > 0) {
      const displayQty = unit ? `${q} ${unit}` : String(q);
      return { qtyNum: q, displayQty };
    }

    if (derivedQty > 0) {
      const displayQty = unit ? `${derivedQty} ${unit}` : String(derivedQty);
      return { qtyNum: derivedQty, displayQty };
    }

    return { qtyNum: 1, displayQty: "1" };
  };

  const items = po.items || [];
  const gstRate = po.gstRate !== undefined && po.gstRate !== null ? Number(po.gstRate) : 18;

  const calculatedSubtotal = items.reduce((sum: number, it: any) => {
    const { qtyNum } = parseItemQty(it);
    const r = Number(it.rate) || 0;
    const a = Number(it.amount) > 0 ? Number(it.amount) : qtyNum * r;
    return sum + a;
  }, 0);

  const subtotal = (Number(po.subtotal) > 0 && calculatedSubtotal === 0)
    ? Number(po.subtotal)
    : calculatedSubtotal;
  const gstAmount = Math.round((subtotal * gstRate) / 100);
  const grandTotal = Math.round(subtotal + gstAmount + Number(po.transportCharges || 0) + Number(po.additionalCharges || 0));
  const amountWords = numberToIndianWords(grandTotal);

  const category = po.category || "PRODUCT";
  const billingCycle = po.billingCycle || "ONE_TIME";

  const cycleDisplayMap: Record<string, string> = {
    ONE_TIME: "One-Time",
    MONTHLY: "Monthly Recurring",
    QUARTERLY: "Quarterly Billing",
    HALF_YEARLY: "Half-Yearly Billing",
    YEARLY: "Yearly / Annual Contract",
    CUSTOM: "Custom Billing",
  };
  const cycleLabel = cycleDisplayMap[billingCycle] || billingCycle;

  const minRows = 4;
  const emptyRowsCount = Math.max(0, minRows - items.length);
  const emptyRows = Array.from({ length: emptyRowsCount });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Purchase Order ${po.poNumber}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
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
      border-bottom: 2px solid #000;
      padding-bottom: 4px;
      background: #f0f4ff;
    }

    .category-badge-bar {
      display: flex;
      justify-content: space-between;
      background: #fafafa;
      border: 1px solid #1a237e;
      padding: 4px 8px;
      font-size: 9.5px;
      font-weight: bold;
      margin-bottom: 6px;
    }

    /* Meta Table */
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: -1px;
    }
    .meta-table td {
      border: 1px solid #000;
      padding: 6px 8px;
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

    /* Signature Section (Without Terms or Bank details as requested) */
    .bottom-signature-section {
      display: flex;
      justify-content: flex-end;
      border: 1px solid #000;
      margin-top: -1px;
      min-height: 110px;
      padding: 10px;
    }
    .sig-col {
      width: 45%;
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
      height: 75px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 4px 0;
    }
    .sig-title {
      font-weight: bold;
      font-size: 10px;
      text-transform: uppercase;
      border-top: 1px dashed #666;
      padding-top: 3px;
    }

    /* Computer Generated Note */
    .computer-note {
      text-align: center;
      font-size: 9.5px;
      font-weight: bold;
      font-style: italic;
      color: #333;
      margin-top: 12px;
      margin-bottom: 4px;
    }

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

    @media print {
      @page {
        size: A4 portrait;
        margin: 0;
      }
      html, body {
        background: #ffffff !important;
        padding: 4mm 6mm !important;
        margin: 0 !important;
        height: auto !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .page-container {
        border: 2px solid #000 !important;
        padding: 6px 8px !important;
        margin: 0 auto !important;
        max-width: 100% !important;
        box-shadow: none !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 15px; text-align: center;">
    <button onclick="window.print()" style="background: #1a237e; color: white; border: none; padding: 10px 24px; font-size: 14px; font-weight: bold; border-radius: 6px; cursor: pointer; shadow: 0 2px 4px rgba(0,0,0,0.2);">
      🖨️ Print / Save Purchase Order PDF
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
              <text x="50" y="70" font-size="28" font-weight="bold" fill="#fff" text-anchor="middle">P</text>
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
      <b>Admin. Office :</b> ${address} | <b>Tel. :</b> ${phone}<br/>
      <b>Visit us :</b> ${website} | <b>E-mail :</b> ${email}<br/>
      <b>CIN :</b> ${cin}
    </div>

    <div class="doc-title">PURCHASE ORDER</div>

    <div class="category-badge-bar">
      <div><span>CATEGORY:</span> ${(po.customCategoryName && po.customCategoryName.trim() !== "" ? po.customCategoryName : (po.category || category)).replace("_", " ").toUpperCase()}</div>
      <div><span>BILLING FREQUENCY:</span> ${cycleLabel.toUpperCase()}</div>
    </div>

    <!-- Meta Details Box -->
    <table class="meta-table">
      <tr>
        <td style="width: 50%;">
          <div><span class="meta-label">PURCHASE ORDER NO. :-</span> <b>${po.poNumber}</b></div>
          <div style="margin-top: 5px;"><span class="meta-label">DATED :-</span> ${dateStr}</div>
          ${po.quotationNumber ? `<div style="margin-top: 5px;"><span class="meta-label">QUOTATION REF. :-</span> <b>${po.quotationNumber}</b></div>` : ""}
        </td>
        <td style="width: 50%;">
          <div><span class="meta-label">Client / Consignee :-</span> <b>${po.customerName}</b></div>
          <div style="margin-top: 3px;"><span class="meta-label">Client Address :-</span> ${po.customerAddress || po.consigneeInfo || "-"}</div>
          ${po.supplierName ? `<div style="margin-top: 4px;"><span class="meta-label">Supplier Name :-</span> <b>${po.supplierName}</b></div>` : ""}
          <div style="margin-top: 4px; background: #fffde7; padding: 3px 5px; border: 1px dashed #fbc02d; rounded: 3px;">
            <span class="meta-label" style="color: #b71c1c;">Supplier Address :-</span> <b>${po.supplierAddress || "N/A"}</b>
          </div>
          ${po.customerGstin ? `<div style="margin-top: 4px;"><span class="meta-label">GSTIN No.</span> ${po.customerGstin}</div>` : ""}
        </td>
      </tr>
    </table>

    <!-- Product Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 8%;">S.No.</th>
          <th style="width: 44%;">Description of Goods</th>
          <th style="width: 16%;">Qty / Duration</th>
          <th style="width: 16%;">Rate per Unit</th>
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

    <!-- Signature Section (Terms & Bank details explicitly omitted) -->
    <div class="bottom-signature-section">
      <div class="sig-col">
        <div class="sig-company">FOR ${companyName}</div>
        <div class="stamp-container" style="position: relative; width: 140px; height: 75px; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
          ${profile?.stampImage ? `<img src="${profile.stampImage}" alt="Stamp Seal" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; opacity: 0.95;" />` : ''}
          ${profile?.signatureImage ? `<img src="${profile.signatureImage}" alt="Signature" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; z-index: 2; mix-blend-mode: multiply;" />` : ''}
          ${(!profile?.stampImage && !profile?.signatureImage) ? `<span style="color: #999; font-size: 9px;">[ OFFICIAL STAMP & SIGN ]</span>` : ''}
        </div>
        <div class="sig-title">${profile?.authorizedSignatory || "AUTHORISED SIGNATORY"}</div>
      </div>
    </div>

    <!-- Computer Generated Note -->
    <div class="computer-note">
      This is a computer generated purchase order no signature is required
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

    const po = await PurchaseOrder.findById(id).lean();
    if (!po) {
      return NextResponse.json({ success: false, error: "Purchase Order not found" }, { status: 404 });
    }

    const companyId = (po as any).companyId || "DEFAULT_COMPANY";
    const profile = await QuotationProfile.findOne({ companyId }).lean();

    const htmlContent = generatePurchaseOrderHtml(po, profile);

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
          "Content-Disposition": `inline; filename="PO_${(po as any).poNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`,
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
    console.error("Error generating purchase order PDF:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
