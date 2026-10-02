import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Expense from "@/models/Expense";
import Brand from "@/models/Brand";
import Company from "@/models/Company";
import { getUserFromCookies } from "@/lib/helper";
import { syncExpenseRefs } from "@/lib/referenceHelper";
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

    const category = searchParams.get("category");
    let brand = searchParams.get("brand");
    const company = searchParams.get("company");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    const isBrandRestricted = userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";

    if (isBrandRestricted) {
      brand = userBrand;
    }

    const query: any = {};
    const andClauses: any[] = [];

    if (deletedAccess.onlyDeleted) {
      andClauses.push({ isDeleted: true });
    }

    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (category && category !== "All") {
      query.category = { $regex: new RegExp(`^${escapeRegExp(category.trim())}$`, "i") };
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
        andClauses.push({ $or: [{ companyId: compDoc._id }, { company: cRegex }] });
      } else {
        andClauses.push({ company: cRegex });
      }
    }

    if (startDate || endDate) {
      query.expenseDate = {};
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        query.expenseDate.$gte = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        query.expenseDate.$lte = e;
      }
    }

    if (search) {
      const sRegex = { $regex: search, $options: "i" };
      query.$or = [
        { title: sRegex },
        { category: sRegex },
        { remarks: sRegex },
        { brand: sRegex },
        { company: sRegex },
        { paymentMode: sRegex },
        { bank: sRegex },
      ];
    }

    if (andClauses.length > 0) {
      query.$and = andClauses;
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
      bank,
      expenseType,
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

    const expenseData: any = {
      title,
      category: category || "Misc",
      amount: Number(amount) || 0,
      expenseDate: eDate,
      paymentMode: paymentMode || "UPI",
      brand: brand || "All Brands",
      company: company || "All Companies",
      bank: bank || "",
      expenseType: expenseType || "variable",
      recordedBy: recordedBy || "Admin",
      isRecurring: Boolean(isRecurring),
      recurringFrequency: recurringFrequency || "Monthly",
      nextRecurringDate: nextRecDate,
      remarks: remarks || "",
    };
    await syncExpenseRefs(expenseData);
    const expense = await Expense.create(expenseData);

    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/expenses:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create expense" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const body = await req.json();

    const targetId = id || body._id || body.id;
    if (!targetId) {
      return NextResponse.json({ success: false, message: "Expense ID is required." }, { status: 400 });
    }

    const {
      title,
      category,
      amount,
      expenseDate,
      paymentMode,
      brand,
      company,
      bank,
      expenseType,
      recordedBy,
      isRecurring,
      recurringFrequency,
      remarks,
    } = body;

    const eDate = expenseDate ? new Date(expenseDate) : new Date();

    let nextRecDate: Date | undefined = undefined;
    if (Boolean(isRecurring)) {
      nextRecDate = new Date(eDate);
      const freq = recurringFrequency || "Monthly";
      if (freq === "Weekly") nextRecDate.setDate(nextRecDate.getDate() + 7);
      else if (freq === "Quarterly") nextRecDate.setMonth(nextRecDate.getMonth() + 3);
      else if (freq === "Yearly") nextRecDate.setFullYear(nextRecDate.getFullYear() + 1);
      else nextRecDate.setMonth(nextRecDate.getMonth() + 1);
    }

    const updatePayload: any = {
      title,
      category: category || "Misc",
      amount: Number(amount) || 0,
      expenseDate: eDate,
      paymentMode: paymentMode || "UPI",
      brand: brand || "All Brands",
      company: company || "All Companies",
      bank: bank || "",
      expenseType: expenseType || "variable",
      recordedBy: recordedBy || "Admin",
      isRecurring: Boolean(isRecurring),
      recurringFrequency: recurringFrequency || "Monthly",
      nextRecurringDate: nextRecDate,
      remarks: remarks || "",
    };
    await syncExpenseRefs(updatePayload);

    const updatedExpense = await Expense.findByIdAndUpdate(
      targetId,
      updatePayload,
      { new: true }
    );

    if (!updatedExpense) {
      return NextResponse.json({ success: false, message: "Expense not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updatedExpense, message: "Expense updated successfully" });
  } catch (error: any) {
    console.error("Error in PUT /api/expenses:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to update expense" },
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
    const expense: any = await Expense.findById(id);
    if (!expense) {
      return NextResponse.json({ success: false, message: "Expense not found" }, { status: 404 });
    }

    expense.isDeleted = true;
    expense.deletedAt = new Date();
    expense.deletedBy = (user as any)?._id || null;
    await expense.save();

    await logAuditEntry({
      collectionName: "expenses",
      docId: expense._id,
      action: "SOFT_DELETE",
      changedFields: [{ field: "isDeleted", oldValue: false, newValue: true }],
      userId: (user as any)?._id
    });

    return NextResponse.json({ success: true, message: "Expense deleted successfully" });
  } catch (error: any) {
    console.error("Error in DELETE /api/expenses:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete expense" },
      { status: 500 }
    );
  }
}
