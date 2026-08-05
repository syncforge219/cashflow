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
        const admDateFilter: any = {};
        const payDateFilter: any = {};
        const expDateFilter: any = {};
        const enqDateFilter: any = {};

        if (gteDate) {
          enqDateFilter.$gte = gteDate;
          admDateFilter.$gte = gteDate;
          payDateFilter.$gte = gteDate;
          expDateFilter.$gte = gteDate;
        }
        if (lteDate) {
          enqDateFilter.$lte = lteDate;
          admDateFilter.$lte = lteDate;
          payDateFilter.$lte = lteDate;
          expDateFilter.$lte = lteDate;
        }

        enquiryQuery.createdAt = enqDateFilter;
        expenseQuery.expenseDate = expDateFilter;

        admissionQuery.$or = [
          { admissionDate: admDateFilter },
          { $and: [{ admissionDate: { $exists: false } }, { createdAt: admDateFilter }] }
        ];

        paymentQuery.$or = [
          { paymentDate: payDateFilter },
          { $and: [{ paymentDate: { $exists: false } }, { createdAt: payDateFilter }] }
        ];
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
