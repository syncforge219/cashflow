import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Payroll from "@/models/Payroll";
import { getUserFromCookies } from "@/lib/helper";
import { logAuditEntry } from "@/lib/auditLogger";
import { validateDeletedAccess } from "@/lib/softDeleteAccess";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const { searchParams } = new URL(req.url);

    const deletedAccess = validateDeletedAccess(user, searchParams);
    if (deletedAccess.errorResponse) {
      return deletedAccess.errorResponse;
    }

    const month = searchParams.get("month");
    const search = searchParams.get("search");
    const brand = searchParams.get("brand");
    const company = searchParams.get("company");

    const query: any = {};
    if (deletedAccess.onlyDeleted) {
      query.isDeleted = true;
    }
    if (month) query.month = month;
    if (brand && brand !== "All" && brand !== "All Brands") {
      query.brand = brand;
    }
    if (company && company !== "All" && company !== "All Companies") {
      query.company = company;
    }
    if (search) {
      query.$or = [
        { employeeName: { $regex: search, $options: "i" } },
        { employeeRole: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
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
      brand,
      company,
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
      brand: brand || "All Brands",
      company: company || "All Companies",
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

    const user = await getUserFromCookies();
    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return NextResponse.json({ success: false, message: "Payroll entry not found" }, { status: 404 });
    }

    payroll.isDeleted = true;
    payroll.deletedAt = new Date();
    payroll.deletedBy = (user as any)?._id || null;
    await payroll.save();

    await logAuditEntry({
      collectionName: "payroll",
      docId: payroll._id,
      action: "SOFT_DELETE",
      changedFields: [{ field: "isDeleted", oldValue: false, newValue: true }],
      userId: (user as any)?._id
    });

    return NextResponse.json({ success: true, message: "Payroll entry deleted successfully" });
  } catch (error: any) {
    console.error("Error in DELETE /api/payroll:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete payroll entry" },
      { status: 500 }
    );
  }
}
