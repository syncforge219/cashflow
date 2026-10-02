import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PurchaseOrder from "@/models/PurchaseOrder";
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
      return NextResponse.json({ success: false, message: "Purchase Order ID required" }, { status: 400 });
    }

    const po = await PurchaseOrder.findById(id, null, { includeDeleted: true });
    if (!po) {
      return NextResponse.json({ success: false, message: "Purchase Order not found" }, { status: 404 });
    }

    po.isDeleted = false;
    po.deletedAt = null;
    po.deletedBy = null;
    await po.save();

    await logAuditEntry({
      collectionName: "purchase_orders",
      docId: po._id,
      action: "RESTORE",
      changedFields: [{ field: "isDeleted", oldValue: true, newValue: false }],
      userId: user._id,
    });

    return NextResponse.json({
      success: true,
      message: "Purchase Order restored successfully.",
      data: po,
    });
  } catch (error: any) {
    console.error("Error restoring purchase order:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to restore purchase order" },
      { status: 500 }
    );
  }
}
