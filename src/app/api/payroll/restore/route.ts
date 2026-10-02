import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Payroll from "@/models/Payroll";
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
      return NextResponse.json({ success: false, message: "Payroll ID required" }, { status: 400 });
    }

    const payroll = await Payroll.findById(id, null, { includeDeleted: true });
    if (!payroll) {
      return NextResponse.json({ success: false, message: "Payroll record not found" }, { status: 404 });
    }

    payroll.isDeleted = false;
    payroll.deletedAt = null;
    payroll.deletedBy = null;
    await payroll.save();

    await logAuditEntry({
      collectionName: "payroll",
      docId: payroll._id,
      action: "RESTORE",
      changedFields: [{ field: "isDeleted", oldValue: true, newValue: false }],
      userId: user._id,
    });

    return NextResponse.json({
      success: true,
      message: "Payroll entry restored successfully.",
      data: payroll,
    });
  } catch (error: any) {
    console.error("Error restoring payroll entry:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to restore payroll entry" },
      { status: 500 }
    );
  }
}
