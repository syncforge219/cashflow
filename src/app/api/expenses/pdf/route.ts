import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import Expense from "@/models/Expense";
import Brand from "@/models/Brand";
import Company from "@/models/Company";
import { getUserFromCookies, escapeRegex } from "@/lib/helper";
import { generateExpensePdfBuffer } from "@/lib/pdfGenerator";

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
    const startRowRaw = searchParams.get("startRow");
    const endRowRaw = searchParams.get("endRow");

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
    const andClauses: any[] = [];
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (category && category !== "All") {
      query.category = { $regex: new RegExp(`^${escapeRegExp(category.trim())}$`, "i") };
    }
    if (brand && brand !== "All" && brand !== "All Brands") {
      const bRegex = new RegExp(`^${escapeRegExp(brand.trim())}$`, "i");
      const brandDoc = (mongoose.Types.ObjectId.isValid(brand)
        ? await Brand.findById(brand).lean()
        : await Brand.findOne({ $or: [{ name: bRegex }, { code: bRegex }] }).lean()) as any;
      if (brandDoc) {
        andClauses.push({ $or: [{ brandId: brandDoc._id }, { brand: bRegex }] });
      } else {
        andClauses.push({ brand: bRegex });
      }
    }
    if (company && company !== "All" && company !== "All Companies") {
      const cRegex = new RegExp(`^${escapeRegExp(company.trim())}$`, "i");
      const compDoc = (mongoose.Types.ObjectId.isValid(company)
        ? await Company.findById(company).lean()
        : await Company.findOne({ $or: [{ name: cRegex }, { legalName: cRegex }] }).lean()) as any;
      if (compDoc) {
        andClauses.push({ $or: [{ companyId: compDoc._id }, { company: cRegex }] });
      } else {
        andClauses.push({ company: cRegex });
      }
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
      const sRegex = { $regex: escapeRegex(search), $options: "i" };
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

    if (andClauses.length > 0) {
      query.$and = andClauses;
    }

    const expenses = await Expense.find(query).sort({ expenseDate: -1, createdAt: -1 }).lean();

    // ── Apply Custom Row Range Slicing if specified ────────────────────
    let finalExpenses = expenses;
    let rangeLabel = "";
    if (startRowRaw || endRowRaw) {
      const startRow = startRowRaw ? Math.max(1, Number(startRowRaw)) : 1;
      const endRow = endRowRaw ? Math.min(expenses.length, Number(endRowRaw)) : expenses.length;
      finalExpenses = expenses.slice(startRow - 1, endRow);
      rangeLabel = ` (Vouchers ${startRow}-${endRow} of ${expenses.length})`;
    }

    // ── Generate Native PDF Buffer (100% zero filesystem font file dependency) ──
    const pdfBuffer = generateExpensePdfBuffer({
      expenses: finalExpenses,
      filters: {
        category: category || undefined,
        brand: brand ? `${brand}${rangeLabel}` : undefined,
        company: company || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: search || undefined,
      },
      generatedAtStr: new Date().toLocaleDateString("en-IN"),
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
