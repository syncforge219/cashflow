import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ProformaInvoice from "@/models/ProformaInvoice";
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
      return NextResponse.json({ success: false, message: "Proforma Invoice ID required" }, { status: 400 });
    }

    const pi: any = await ProformaInvoice.findById(id, null, { includeDeleted: true });
    if (!pi) {
      return NextResponse.json({ success: false, message: "Proforma Invoice not found" }, { status: 404 });
    }

    pi.isDeleted = false;
    pi.deletedAt = null;
    pi.deletedBy = null;
    await pi.save();

    await logAuditEntry({
      collectionName: "proforma_invoices",
      docId: pi._id,
      action: "RESTORE",
      changedFields: [{ field: "isDeleted", oldValue: true, newValue: false }],
      userId: user._id,
    });

    return NextResponse.json({
      success: true,
      message: "Proforma Invoice restored successfully.",
      data: pi,
    });
  } catch (error: any) {
    console.error("Error restoring proforma invoice:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to restore proforma invoice" },
      { status: 500 }
    );
  }
}
