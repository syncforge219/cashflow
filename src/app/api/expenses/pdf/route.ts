import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Expense from "@/models/Expense";
import { getUserFromCookies } from "@/lib/helper";
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

    // ── Generate Native PDF Buffer (100% zero filesystem font file dependency) ──
    const pdfBuffer = generateExpensePdfBuffer({
      expenses,
      filters: {
        category: category || undefined,
        brand: brand || undefined,
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
