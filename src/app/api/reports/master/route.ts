import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import User from "@/models/User";
import Counsellor from "@/models/Counsellor";
import Brand from "@/models/Brand";
import Company from "@/models/Company";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let dateQuery: any = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.createdAt.$lte = end;
      }
    }

    const [enquiries, admissions, payments, users, counsellorsModel, brands, companies] = await Promise.all([
      Enquiry.find(dateQuery).sort({ createdAt: -1 }).lean(),
      Admission.find({}).sort({ createdAt: -1 }).lean(),
      Payment.find({}).sort({ createdAt: -1 }).lean(),
      User.find({}).lean(),
      Counsellor.find({}).lean(),
      Brand.find({}).lean(),
      Company.find({}).lean(),
    ]);

    const counsellors = users.filter(u => u.role === "counsellor" || u.role === "counselor");
    const brandManagers = users.filter(u => u.role === "brand manager" || u.role === "manager");

    return NextResponse.json({
      success: true,
      data: {
        enquiries,
        admissions,
        payments,
        users,
        counsellors,
        counsellorsModel,
        brandManagers,
        brands,
        companies,
      }
    });
  } catch (error: any) {
    console.error("Master Report API Error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch master report data" },
      { status: 500 }
    );
  }
}
