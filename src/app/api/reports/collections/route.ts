import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Payment from "@/models/Payment";

import mongoose from "mongoose";
import Brand from "@/models/Brand";
import Company from "@/models/Company";
import "@/models/Admission"; // registers the model used by populate("admissionId")
import { toDateKey, istDayRange } from "@/lib/dates";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const brand = searchParams.get("brand");
    const company = searchParams.get("company");

    let query: any = {};
    const andClauses: any[] = [];
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // IST calendar days, whatever the server's time zone
    const fromKey = toDateKey(startDate);
    const toKey = toDateKey(endDate);
    if (fromKey && toKey) {
      const { start, end } = istDayRange(fromKey, toKey);
      query.paymentDate = { $gte: start, $lte: end };
    } else if (fromKey) {
      query.paymentDate = { $gte: istDayRange(fromKey).start };
    } else if (toKey) {
      query.paymentDate = { $lte: istDayRange(toKey).end };
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
      // Payments store the company name in "company" (there is no companyAssigned on Payment)
      if (compDoc) {
        andClauses.push({ $or: [{ companyId: compDoc._id }, { company: cRegex }] });
      } else {
        andClauses.push({ company: cRegex });
      }
    }

    if (andClauses.length > 0) {
      query.$and = andClauses;
    }

    const payments = await Payment.find(query)
      .populate({
        path: "admissionId",
        select: "fullName studentFullName mobileNumber email course brand brandId companyAssigned companyId counsellor counsellorId",
      })
      .populate({
        path: "brandId",
        select: "name code",
      })
      .populate({
        path: "companyId",
        select: "name legalName gstin",
      })
      .sort({ paymentDate: -1, createdAt: -1 });

    return NextResponse.json({ success: true, data: payments });
  } catch (error: any) {
    console.error("Collections Report API Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch collections data" },
      { status: 500 }
    );
  }
}
