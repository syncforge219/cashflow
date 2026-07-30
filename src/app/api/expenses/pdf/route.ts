import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import dbConnect from "@/lib/db";
import Expense from "@/models/Expense";
import { getUserFromCookies } from "@/lib/helper";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const { searchParams } = new URL(req.url);

    const category = searchParams.get("category");
    let brand = searchParams.get("brand");
    const company = searchParams.get("company");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    const isBrandRestricted =
      userBrand &&
      userBrand !== "All Brands" &&
      userBrand !== "All" &&
      userBrand !== "*" &&
      userBrand !== "global";

    if (isBrandRestricted) {
      brand = userBrand;
    }

    const query: any = {};
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (category && category !== "All") {
      query.category = { $regex: new RegExp(`^${escapeRegExp(category.trim())}$`, "i") };
    }
    if (brand && brand !== "All" && brand !== "All Brands") {
      query.brand = { $regex: new RegExp(`^${escapeRegExp(brand.trim())}$`, "i") };
    }
    if (company && company !== "All" && company !== "All Companies") {
      query.company = { $regex: new RegExp(`^${escapeRegExp(company.trim())}$`, "i") };
    }
    if (startDate || endDate) {
      query.expenseDate = {};
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        query.expenseDate.$gte = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        query.expenseDate.$lte = e;
      }
    }
    if (search) {
      const sRegex = { $regex: search, $options: "i" };
      query.$or = [
        { title: sRegex },
        { category: sRegex },
        { remarks: sRegex },
        { brand: sRegex },
        { company: sRegex },
        { paymentMode: sRegex },
        { bank: sRegex },
      ];
    }

    const expenses = await Expense.find(query).sort({ expenseDate: -1, createdAt: -1 }).lean();

    // ── Generate Native PDF Document using PDFKit ───────────────────────
    const doc = new PDFDocument({ size: "A4", margin: 30, bufferPages: true });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: any) => chunks.push(chunk));

    // PDF Helper utilities
    const formatCurrency = (amt: number) => `Rs.${Number(amt || 0).toLocaleString("en-IN")}`;
    const formatDate = (d: any) =>
      d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

    const totalAmount = expenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    const totalCount = expenses.length;

    const variableTotal = expenses
      .filter((e: any) => (e.expenseType || "variable").toLowerCase() === "variable")
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    const fixedTotal = expenses
      .filter((e: any) => (e.expenseType || "").toLowerCase() === "fixed")
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

    const cashTotal = expenses
      .filter((e: any) => (e.paymentMode || "").toLowerCase() === "cash")
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
    const bankTotal = Math.max(0, totalAmount - cashTotal);

    // ── PAGE 1: HEADER & EXECUTIVE SCORECARDS ────────────────────────────
    // 1. Top Header Banner Box
    doc.rect(30, 30, 535, 60).fill("#1e1b4b");
    doc.fillColor("#ffffff").fontSize(15).font("Helvetica-Bold").text("COACHFLOW ERP - FINANCIAL INTELLIGENCE", 45, 42);
    doc.fontSize(11).font("Helvetica").text("OPERATIONAL EXPENSE EXECUTIVE REPORT", 45, 60);

    doc.fillColor("#818cf8").fontSize(8).font("Helvetica-Bold").text(`GENERATED: ${new Date().toLocaleDateString("en-IN")}`, 400, 45, { align: "right", width: 150 });
    doc.fillColor("#cbd5e1").fontSize(8).font("Helvetica").text(`TOTAL RECORDS: ${totalCount}`, 400, 60, { align: "right", width: 150 });

    // 2. Filter Summary Bar
    doc.rect(30, 98, 535, 22).fill("#f1f5f9").strokeColor("#cbd5e1").lineWidth(0.5).stroke();
    doc.fillColor("#334155").fontSize(8).font("Helvetica-Bold").text(
      `ACTIVE FILTERS: Brand: ${brand || "All Brands"}  |  Company: ${company || "All Companies"}  |  Category: ${category || "All"}`,
      40,
      105
    );

    // 3. KPI Scorecard Boxes Grid (2x2)
    // Box A: Total Operational Spend
    doc.rect(30, 130, 260, 50).fill("#fff1f2").strokeColor("#fecdd3").lineWidth(1).stroke();
    doc.rect(30, 130, 4, 50).fill("#e11d48");
    doc.fillColor("#9f1239").fontSize(8).font("Helvetica-Bold").text("TOTAL OPERATIONAL SPEND", 42, 138);
    doc.fillColor("#be123c").fontSize(14).font("Helvetica-Bold").text(formatCurrency(totalAmount), 42, 150);
    doc.fillColor("#881337").fontSize(7).font("Helvetica").text(`${totalCount} Total Billed Transactions`, 42, 168);

    // Box B: Variable Expenses
    doc.rect(305, 130, 260, 50).fill("#faf5ff").strokeColor("#e9d5ff").lineWidth(1).stroke();
    doc.rect(305, 130, 4, 50).fill("#9333ea");
    doc.fillColor("#6b21a8").fontSize(8).font("Helvetica-Bold").text("VARIABLE EXPENSES", 317, 138);
    doc.fillColor("#7e22ce").fontSize(14).font("Helvetica-Bold").text(formatCurrency(variableTotal), 317, 150);
    doc.fillColor("#581c87").fontSize(7).font("Helvetica").text(`${totalAmount > 0 ? ((variableTotal / totalAmount) * 100).toFixed(1) : 0}% Share of Total Spend`, 317, 168);

    // Box C: Fixed Expenses
    doc.rect(30, 190, 260, 50).fill("#eef2ff").strokeColor("#c7d2fe").lineWidth(1).stroke();
    doc.rect(30, 190, 4, 50).fill("#4f46e5");
    doc.fillColor("#3730a3").fontSize(8).font("Helvetica-Bold").text("FIXED EXPENSES (RENT, SALARIES)", 42, 198);
    doc.fillColor("#4338ca").fontSize(14).font("Helvetica-Bold").text(formatCurrency(fixedTotal), 42, 210);
    doc.fillColor("#312e81").fontSize(7).font("Helvetica").text(`${totalAmount > 0 ? ((fixedTotal / totalAmount) * 100).toFixed(1) : 0}% Share of Total Spend`, 42, 228);

    // Box D: Cash vs Bank Ratio
    doc.rect(305, 190, 260, 50).fill("#ecfdf5").strokeColor("#a7f3d0").lineWidth(1).stroke();
    doc.rect(305, 190, 4, 50).fill("#059669");
    doc.fillColor("#065f46").fontSize(8).font("Helvetica-Bold").text("BANK VS CASH RATIO", 317, 198);
    doc.fillColor("#047857").fontSize(14).font("Helvetica-Bold").text(`${totalAmount > 0 ? ((bankTotal / totalAmount) * 100).toFixed(0) : 0}% Digital / Bank`, 317, 210);
    doc.fillColor("#064e3b").fontSize(7).font("Helvetica").text(`Cash Spend: ${formatCurrency(cashTotal)}`, 317, 228);

    // ── VISUAL ANALYTICS & INSIGHT GRAPHS SECTION ─────────────────────
    doc.rect(30, 252, 535, 18).fill("#0f172a");
    doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold").text("FINANCIAL INSIGHT GRAPH ANALYTICS & BREAKDOWN", 40, 256);

    // GRAPH 1: Top Category Spend Breakdown (Vector Bars)
    const categoryMap: Record<string, number> = {};
    expenses.forEach((e: any) => {
      const cat = e.category || "Misc";
      categoryMap[cat] = (categoryMap[cat] || 0) + (Number(e.amount) || 0);
    });

    const topCategories = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const maxCatVal = Math.max(...topCategories.map((c) => c[1]), 1);

    doc.rect(30, 278, 260, 140).fill("#ffffff").strokeColor("#e2e8f0").lineWidth(1).stroke();
    doc.fillColor("#1e293b").fontSize(9).font("Helvetica-Bold").text("GRAPH 1: TOP CATEGORY SPEND (INR)", 40, 286);

    let catY = 302;
    topCategories.forEach(([catName, amt]) => {
      const barWidth = Math.max((amt / maxCatVal) * 120, 5);
      const pct = totalAmount > 0 ? ((amt / totalAmount) * 100).toFixed(1) : "0.0";

      doc.fillColor("#475569").fontSize(7.5).font("Helvetica-Bold").text(catName.length > 14 ? catName.slice(0, 13) + "." : catName, 40, catY);
      doc.rect(120, catY, barWidth, 10).fill("#4f46e5");
      doc.fillColor("#0f172a").fontSize(7.5).font("Helvetica-Bold").text(`${formatCurrency(amt)} (${pct}%)`, 125 + barWidth, catY);
      catY += 22;
    });

    // GRAPH 2: Payment Mode Distribution
    const paymentMap: Record<string, number> = {};
    expenses.forEach((e: any) => {
      const mode = e.paymentMode || "Cash";
      paymentMap[mode] = (paymentMap[mode] || 0) + (Number(e.amount) || 0);
    });
    const paymentModes = Object.entries(paymentMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    doc.rect(305, 278, 260, 140).fill("#ffffff").strokeColor("#e2e8f0").lineWidth(1).stroke();
    doc.fillColor("#1e293b").fontSize(9).font("Helvetica-Bold").text("GRAPH 2: PAYMENT MODE BREAKDOWN", 315, 286);

    const pColors = ["#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899"];
    let payY = 304;
    paymentModes.forEach(([mode, amt], i) => {
      const color = pColors[i % pColors.length];
      const pct = totalAmount > 0 ? ((amt / totalAmount) * 100).toFixed(1) : "0.0";

      doc.rect(315, payY + 2, 8, 8).fill(color);
      doc.fillColor("#334155").fontSize(8).font("Helvetica-Bold").text(mode, 328, payY);
      doc.fillColor("#0f172a").fontSize(8).font("Helvetica-Bold").text(`${formatCurrency(amt)} (${pct}%)`, 440, payY, { align: "right", width: 110 });
      payY += 22;
    });

    // GRAPH 3: Variable vs Fixed Cost Nature Comparison
    doc.rect(30, 426, 260, 95).fill("#ffffff").strokeColor("#e2e8f0").lineWidth(1).stroke();
    doc.fillColor("#1e293b").fontSize(9).font("Helvetica-Bold").text("GRAPH 3: VARIABLE VS FIXED COST NATURE", 40, 434);

    const varPct = totalAmount > 0 ? Math.round((variableTotal / totalAmount) * 100) : 0;
    const fixPct = totalAmount > 0 ? Math.round((fixedTotal / totalAmount) * 100) : 0;

    doc.fillColor("#7e22ce").fontSize(8).font("Helvetica-Bold").text(`Variable Spend: ${formatCurrency(variableTotal)} (${varPct}%)`, 40, 452);
    doc.rect(40, 463, Math.max((varPct / 100) * 230, 5), 10).fill("#9333ea");

    doc.fillColor("#3730a3").fontSize(8).font("Helvetica-Bold").text(`Fixed Spend: ${formatCurrency(fixedTotal)} (${fixPct}%)`, 40, 482);
    doc.rect(40, 493, Math.max((fixPct / 100) * 230, 5), 10).fill("#4f46e5");

    // GRAPH 4: Brand Allocation Breakdown
    const brandMap: Record<string, number> = {};
    expenses.forEach((e: any) => {
      const b = e.brand && e.brand !== "All Brands" ? e.brand : "Unassigned";
      brandMap[b] = (brandMap[b] || 0) + (Number(e.amount) || 0);
    });
    const brandModes = Object.entries(brandMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const maxBrandVal = Math.max(...brandModes.map((b) => b[1]), 1);

    doc.rect(305, 426, 260, 95).fill("#ffffff").strokeColor("#e2e8f0").lineWidth(1).stroke();
    doc.fillColor("#1e293b").fontSize(9).font("Helvetica-Bold").text("GRAPH 4: BRAND SPEND ALLOCATION", 315, 434);

    let brandY = 452;
    brandModes.forEach(([bName, amt]) => {
      const bWidth = Math.max((amt / maxBrandVal) * 110, 5);
      doc.fillColor("#475569").fontSize(7.5).font("Helvetica-Bold").text(bName.length > 13 ? bName.slice(0, 12) + "." : bName, 315, brandY);
      doc.rect(390, brandY, bWidth, 8).fill("#0284c7");
      doc.fillColor("#0f172a").fontSize(7.5).font("Helvetica-Bold").text(formatCurrency(amt), 395 + bWidth, brandY);
      brandY += 16;
    });

    // ── EXPENSE DETAILED REGISTER TABLE ──────────────────────────────────
    let tableY = 535;

    const renderTableHeader = (y: number) => {
      doc.rect(30, y, 535, 18).fill("#1e293b");
      doc.fillColor("#ffffff").fontSize(7.5).font("Helvetica-Bold");
      doc.text("S.No", 35, y + 5, { width: 25 });
      doc.text("Date", 62, y + 5, { width: 55 });
      doc.text("Category", 120, y + 5, { width: 85 });
      doc.text("Description", 210, y + 5, { width: 110 });
      doc.text("Amount", 325, y + 5, { width: 60, align: "right" });
      doc.text("Mode", 390, y + 5, { width: 45 });
      doc.text("Brand", 440, y + 5, { width: 60 });
      doc.text("Nature", 505, y + 5, { width: 55 });
    };

    renderTableHeader(tableY);
    tableY += 20;

    expenses.forEach((exp: any, idx: number) => {
      // Check if near page bottom (A4 height is 842 pt)
      if (tableY > 780) {
        doc.addPage();
        tableY = 35;
        renderTableHeader(tableY);
        tableY += 20;
      }

      if (idx % 2 === 1) {
        doc.rect(30, tableY - 2, 535, 16).fill("#f8fafc");
      }

      doc.fillColor("#334155").fontSize(7).font("Helvetica");
      doc.text(String(idx + 1), 35, tableY, { width: 25 });
      doc.text(formatDate(exp.expenseDate), 62, tableY, { width: 55 });
      doc.font("Helvetica-Bold").text((exp.category || "Misc").slice(0, 16), 120, tableY, { width: 85 });
      doc.font("Helvetica").text((exp.title || "").slice(0, 24), 210, tableY, { width: 110 });

      doc.fillColor("#be123c").font("Helvetica-Bold").text(formatCurrency(exp.amount), 325, tableY, { width: 60, align: "right" });

      doc.fillColor("#334155").font("Helvetica").text((exp.paymentMode || "Cash").slice(0, 9), 390, tableY, { width: 45 });
      doc.text((exp.brand || "-").slice(0, 11), 440, tableY, { width: 60 });
      doc.text((exp.expenseType || "variable").slice(0, 10), 505, tableY, { width: 55 });

      tableY += 17;
    });

    // Render Table Grand Total Row
    if (tableY > 780) {
      doc.addPage();
      tableY = 35;
    }

    doc.rect(30, tableY, 535, 20).fill("#0f172a");
    doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold").text("GRAND TOTAL OPERATIONAL EXPENDITURE", 40, tableY + 6);
    doc.fillColor("#34d399").fontSize(9).font("Helvetica-Bold").text(formatCurrency(totalAmount), 325, tableY + 5, { width: 60, align: "right" });
    doc.fillColor("#cbd5e1").fontSize(7.5).font("Helvetica").text(`${totalCount} Transactions Audited`, 400, tableY + 6, { align: "right", width: 155 });

    // End and return buffer
    doc.end();

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err: any) => reject(err));
    });

    const safeDate = new Date().toISOString().split("T")[0];

    return new NextResponse(Uint8Array.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Expense_Executive_Report_${safeDate}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Error generating expense PDF report:", error);
    return new NextResponse(JSON.stringify({ error: error.message || "Failed to generate expense PDF report" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
