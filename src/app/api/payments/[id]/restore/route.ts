import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Payment from "@/models/Payment";
import { getUserFromCookies } from "@/lib/helper";
import { logAuditEntry } from "@/lib/auditLogger";
import { recomputeAndStoreAdmissionBalance } from "@/lib/studentBalanceService";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
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

    const payment = await Payment.findById(id, null, { includeDeleted: true });
    if (!payment) {
      return NextResponse.json({ success: false, message: "Payment not found" }, { status: 404 });
    }

    payment.isDeleted = false;
    payment.deletedAt = null;
    payment.deletedBy = null;
    await payment.save();

    if (payment.admissionId) {
      await recomputeAndStoreAdmissionBalance(payment.admissionId);
    }

    await logAuditEntry({
      collectionName: "payments",
      docId: payment._id,
      action: "RESTORE",
      changedFields: [{ field: "isDeleted", oldValue: true, newValue: false }],
      userId: user._id,
    });

    return NextResponse.json({
      success: true,
      message: "Payment restored successfully.",
      data: payment,
    });
  } catch (error: any) {
    console.error("Error restoring payment:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to restore payment" },
      { status: 500 }
    );
  }
}
