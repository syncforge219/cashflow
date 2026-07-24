import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Payroll from "@/models/Payroll";
import Expense from "@/models/Expense";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const [admissions, payrolls, expenses] = await Promise.all([
      Admission.find({}).lean(),
      Payroll.find({}).lean(),
      Expense.find({}).lean(),
    ]);

    const totalFeeCollected = admissions.reduce((sum: number, a: any) => {
      const paidInstallments = (a.installmentPlan || [])
        .filter((i: any) => i.status === "Paid")
        .reduce((instSum: number, i: any) => instSum + (i.amountPaid || i.amount || 0), 0);
      return sum + paidInstallments;
    }, 0);

    const totalPayrollPaid = payrolls
      .filter((p: any) => p.paymentStatus === "Paid")
      .reduce((sum: number, p: any) => sum + (p.netSalary || 0), 0);

    const totalExpenseAmount = expenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

    const netProfit = totalFeeCollected - (totalPayrollPaid + totalExpenseAmount);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalFeeCollected,
          totalPayrollPaid,
          totalExpenseAmount,
          netProfit,
        },
        admissionsCount: admissions.length,
        payrollsCount: payrolls.length,
        expensesCount: expenses.length,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/reports:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch reports" },
      { status: 500 }
    );
  }
}
