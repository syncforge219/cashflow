import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Expense from "@/models/Expense";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const brand = searchParams.get("brand");
    const company = searchParams.get("company");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const query: any = {};

    if (category && category !== "All") {
      query.category = category;
    }

    if (brand && brand !== "All" && brand !== "All Brands") {
      query.brand = brand;
    }

    if (company && company !== "All" && company !== "All Companies") {
      query.company = company;
    }

    if (startDate && endDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      query.expenseDate = { $gte: s, $lte: e };
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { remarks: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
      ];
    }

    const expenses = await Expense.find(query).sort({ expenseDate: -1, createdAt: -1 }).lean();

    return NextResponse.json({ success: true, data: expenses });
  } catch (error: any) {
    console.error("Error in GET /api/expenses:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const {
      title,
      category,
      amount,
      expenseDate,
      paymentMode,
      brand,
      company,
      recordedBy,
      isRecurring,
      recurringFrequency,
      remarks,
    } = body;

    if (!title || amount === undefined) {
      return NextResponse.json(
        { success: false, message: "Expense title and amount are required." },
        { status: 400 }
      );
    }

    const eDate = expenseDate ? new Date(expenseDate) : new Date();

    let nextRecDate: Date | undefined = undefined;
    if (Boolean(isRecurring)) {
      nextRecDate = new Date(eDate);
      const freq = recurringFrequency || "Monthly";
      if (freq === "Weekly") nextRecDate.setDate(nextRecDate.getDate() + 7);
      else if (freq === "Quarterly") nextRecDate.setMonth(nextRecDate.getMonth() + 3);
      else if (freq === "Yearly") nextRecDate.setFullYear(nextRecDate.getFullYear() + 1);
      else nextRecDate.setMonth(nextRecDate.getMonth() + 1); // Monthly default
    }

    const expense = await Expense.create({
      title,
      category: category || "Misc",
      amount: Number(amount) || 0,
      expenseDate: eDate,
      paymentMode: paymentMode || "UPI",
      brand: brand || "All Brands",
      company: company || "All Companies",
      recordedBy: recordedBy || "Admin",
      isRecurring: Boolean(isRecurring),
      recurringFrequency: recurringFrequency || "Monthly",
      nextRecurringDate: nextRecDate,
      remarks: remarks || "",
    });

    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/expenses:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create expense" },
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

    await Expense.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: "Expense deleted successfully" });
  } catch (error: any) {
    console.error("Error in DELETE /api/expenses:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete expense" },
      { status: 500 }
    );
  }
}
