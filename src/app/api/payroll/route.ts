import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Payroll from "@/models/Payroll";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const search = searchParams.get("search");

    const query: any = {};
    if (month) query.month = month;
    if (search) {
      query.$or = [
        { employeeName: { $regex: search, $options: "i" } },
        { employeeRole: { $regex: search, $options: "i" } },
      ];
    }

    const payrolls = await Payroll.find(query).sort({ paymentDate: -1, createdAt: -1 }).lean();

    return NextResponse.json({ success: true, data: payrolls });
  } catch (error: any) {
    console.error("Error in GET /api/payroll:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch payroll" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const {
      employeeName,
      employeeRole,
      month,
      baseSalary,
      bonus,
      deductions,
      paymentStatus,
      paymentDate,
      paymentMode,
      isRecurring,
      recurringFrequency,
      remarks,
    } = body;

    if (!employeeName || !month || baseSalary === undefined) {
      return NextResponse.json(
        { success: false, message: "Employee name, month, and base salary are required." },
        { status: 400 }
      );
    }

    const numBase = Number(baseSalary) || 0;
    const numBonus = Number(bonus) || 0;
    const numDeductions = Number(deductions) || 0;
    const netSalary = numBase + numBonus - numDeductions;
    const pDate = paymentDate ? new Date(paymentDate) : new Date();

    let nextRecDate: Date | undefined = undefined;
    if (Boolean(isRecurring)) {
      nextRecDate = new Date(pDate);
      const freq = recurringFrequency || "Monthly";
      if (freq === "Weekly") nextRecDate.setDate(nextRecDate.getDate() + 7);
      else if (freq === "Quarterly") nextRecDate.setMonth(nextRecDate.getMonth() + 3);
      else if (freq === "Yearly") nextRecDate.setFullYear(nextRecDate.getFullYear() + 1);
      else nextRecDate.setMonth(nextRecDate.getMonth() + 1); // Monthly default
    }

    const payroll = await Payroll.create({
      employeeName,
      employeeRole: employeeRole || "Staff",
      month,
      baseSalary: numBase,
      bonus: numBonus,
      deductions: numDeductions,
      netSalary,
      paymentStatus: paymentStatus || "Paid",
      paymentDate: pDate,
      paymentMode: paymentMode || "Bank Transfer",
      isRecurring: Boolean(isRecurring),
      recurringFrequency: recurringFrequency || "Monthly",
      nextRecurringDate: nextRecDate,
      remarks: remarks || "",
    });

    return NextResponse.json({ success: true, data: payroll }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/payroll:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create payroll entry" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "ID parameter required" }, { status: 400 });
    }

    await Payroll.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: "Payroll entry deleted successfully" });
  } catch (error: any) {
    console.error("Error in DELETE /api/payroll:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete payroll entry" },
      { status: 500 }
    );
  }
}
