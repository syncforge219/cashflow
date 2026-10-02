import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Payment from "@/models/Payment";

import mongoose from "mongoose";
import Brand from "@/models/Brand";
import Company from "@/models/Company";

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

    if (startDate && endDate) {
      query.paymentDate = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    } else if (startDate) {
      query.paymentDate = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.paymentDate = { $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) };
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
        andClauses.push({ $or: [{ companyId: compDoc._id }, { companyAssigned: cRegex }] });
      } else {
        andClauses.push({ companyAssigned: cRegex });
      }
    }

    if (andClauses.length > 0) {
      query.$and = andClauses;
    }

    // Ensure Admission model is registered before populating
    require("@/models/Admission");
    require("@/models/Brand");
    require("@/models/Company");

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
      .sort({ paymentDate: -1 });

    return NextResponse.json({ success: true, data: payments });
  } catch (error: any) {
    console.error("Collections Report API Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch collections data" },
      { status: 500 }
    );
  }
}
