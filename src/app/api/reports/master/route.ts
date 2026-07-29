import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import User from "@/models/User";
import Counsellor from "@/models/Counsellor";
import Brand from "@/models/Brand";
import Company from "@/models/Company";
import Expense from "@/models/Expense";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let enquiryQuery: any = {};
    let admissionQuery: any = {};
    let paymentQuery: any = {};
    let expenseQuery: any = {};

    if (startDate || endDate) {
      const gteDate = startDate ? new Date(startDate) : undefined;
      let lteDate: Date | undefined;

      if (endDate) {
        lteDate = new Date(endDate);
        lteDate.setHours(23, 59, 59, 999);
      }

      if (gteDate || lteDate) {
        enquiryQuery.createdAt = {};
        admissionQuery.createdAt = {};
        paymentQuery.paymentDate = {};
        expenseQuery.expenseDate = {};

        if (gteDate) {
          enquiryQuery.createdAt.$gte = gteDate;
          admissionQuery.createdAt.$gte = gteDate;
          paymentQuery.paymentDate.$gte = gteDate;
          expenseQuery.expenseDate.$gte = gteDate;
        }
        if (lteDate) {
          enquiryQuery.createdAt.$lte = lteDate;
          admissionQuery.createdAt.$lte = lteDate;
          paymentQuery.paymentDate.$lte = lteDate;
          expenseQuery.expenseDate.$lte = lteDate;
        }
      }
    }

    const [enquiries, admissions, payments, users, counsellorsModel, brands, companies, expenses] = await Promise.all([
      Enquiry.find(enquiryQuery).sort({ createdAt: -1 }).lean(),
      Admission.find(admissionQuery).sort({ createdAt: -1 }).lean(),
      Payment.find(paymentQuery).populate("admissionId").sort({ paymentDate: -1, createdAt: -1 }).lean(),
      User.find({}).lean(),
      Counsellor.find({}).lean(),
      Brand.find({}).lean(),
      Company.find({}).lean(),
      Expense.find(expenseQuery).sort({ expenseDate: -1 }).lean(),
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
        expenses,
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
