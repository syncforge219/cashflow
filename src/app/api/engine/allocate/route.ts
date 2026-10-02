import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Company from "@/models/Company";
import Brand from "@/models/Brand";
import { getFinancialYearRange } from "@/lib/financialYearHelper";
import { getCompanyPaymentRevenueMap } from "@/lib/companyRevenueHelper";

function escapeRegex(text: string) {
  return text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const rawBrandName = searchParams.get("brandId") || searchParams.get("brand") || "";
    const cleanBrand = rawBrandName.trim();

    let availableCompanies: any[] = [];

    if (cleanBrand) {
      const isOid = mongoose.Types.ObjectId.isValid(cleanBrand);
      const safeBrand = escapeRegex(cleanBrand);
      const brandRegex = new RegExp(`^${safeBrand}$`, "i");

      // 1. Find Brand document by ObjectId or case-insensitively by name/code
      const brandDoc = await Brand.findOne({
        $or: [
          ...(isOid ? [{ _id: cleanBrand }] : []),
          { name: brandRegex },
          { code: brandRegex }
        ]
      }).lean();

      const brandCompanies = brandDoc?.companies || [];

      // 2. Query Companies by brand regex or companies array
      const orConditions: any[] = [
        { brand: brandRegex },
        { brands: brandRegex }
      ];

      if (brandCompanies.length > 0) {
        const safeCompNames = brandCompanies.map((c: string) => new RegExp(`^${escapeRegex(c.trim())}$`, "i"));
        orConditions.push({ name: { $in: safeCompNames } });
      }

      availableCompanies = await Company.find({
        $or: orConditions,
        status: { $ne: "INACTIVE" }
      }).lean();
    }

    // 3. Fallback: If no companies matched specific brand or brand was empty, find all active companies
    if (availableCompanies.length === 0) {
      availableCompanies = await Company.find({
        status: { $ne: "INACTIVE" }
      }).lean();
    }

    // 4. Sort companies by remaining capacity cap for current 1st April - 31st March cycle using Payment aggregation
    if (availableCompanies.length > 0) {
      const fyRange = getFinancialYearRange();
      const fyRevenueMap = await getCompanyPaymentRevenueMap(fyRange);

      const getRemCap = (c: any) => {
        const cap = Number(c.annualCapacityCap || 1949999);
        const collected = fyRevenueMap.get(String(c._id)) || 0;
        return Math.max(0, cap - collected);
      };

      availableCompanies.sort((a, b) => getRemCap(b) - getRemCap(a));

      const bestCompany = availableCompanies[0];
      const remCap = getRemCap(bestCompany);

      if (remCap > 0) {
        return NextResponse.json({
          success: true,
          company: bestCompany.name,
          companyId: bestCompany._id,
          financialYear: fyRange.label
        });
      }
    }

    return NextResponse.json({ success: true, company: "Unallocated", companyId: null });
  } catch (error: any) {
    console.error("Engine Allocation Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
