import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import { getUserFromCookies } from "@/lib/helper";
import { logAuditEntry } from "@/lib/auditLogger";

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

    const admFilter = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { admissionId: id };
    const admission = await Admission.findOne(admFilter, null, { includeDeleted: true });

    if (!admission) {
      return NextResponse.json({ success: false, message: "Student record not found" }, { status: 404 });
    }

    admission.isDeleted = false;
    admission.deletedAt = null;
    admission.deletedBy = null;
    await admission.save();

    // Restore associated soft-deleted payments
    await Payment.updateMany(
      { admissionId: admission._id, isDeleted: true },
      { $set: { isDeleted: false, deletedAt: null, deletedBy: null } }
    );

    await logAuditEntry({
      collectionName: "admissions",
      docId: admission._id,
      action: "RESTORE",
      changedFields: [{ field: "isDeleted", oldValue: true, newValue: false }],
      userId: user._id,
    });

    return NextResponse.json({
      success: true,
      message: "Student record and associated payments restored successfully.",
      data: admission,
    });
  } catch (error: any) {
    console.error("Error restoring admission:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to restore admission" },
      { status: 500 }
    );
  }
}
