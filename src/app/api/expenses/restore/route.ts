import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Expense from "@/models/Expense";
import { getUserFromCookies } from "@/lib/helper";
import { logAuditEntry } from "@/lib/auditLogger";

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();

    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const userRole = (user.role || "").toLowerCase().trim();
    if (userRole !== "super admin" && userRole !== "super_admin") {
      return NextResponse.json(
        { success: false, message: "Forbidden: Only Super Admin can view or restore deleted records." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);
    const id = body.id || searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Expense ID required" }, { status: 400 });
    }

    const expense = await Expense.findById(id, null, { includeDeleted: true });
    if (!expense) {
      return NextResponse.json({ success: false, message: "Expense not found" }, { status: 404 });
    }

    expense.isDeleted = false;
    expense.deletedAt = null;
    expense.deletedBy = null;
    await expense.save();

    await logAuditEntry({
      collectionName: "expenses",
      docId: expense._id,
      action: "RESTORE",
      changedFields: [{ field: "isDeleted", oldValue: true, newValue: false }],
      userId: user._id,
    });

    return NextResponse.json({
      success: true,
      message: "Expense restored successfully.",
      data: expense,
    });
  } catch (error: any) {
    console.error("Error restoring expense:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to restore expense" },
      { status: 500 }
    );
  }
}
