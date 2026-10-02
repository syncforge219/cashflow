import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Quotation from "@/models/Quotation";
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
      return NextResponse.json({ success: false, message: "Quotation ID required" }, { status: 400 });
    }

    const quotation: any = await Quotation.findById(id, null, { includeDeleted: true });
    if (!quotation) {
      return NextResponse.json({ success: false, message: "Quotation not found" }, { status: 404 });
    }

    quotation.isDeleted = false;
    quotation.deletedAt = null;
    quotation.deletedBy = null;
    await quotation.save();

    await logAuditEntry({
      collectionName: "quotations",
      docId: quotation._id,
      action: "RESTORE",
      changedFields: [{ field: "isDeleted", oldValue: true, newValue: false }],
      userId: user._id,
    });

    return NextResponse.json({
      success: true,
      message: "Quotation restored successfully.",
      data: quotation,
    });
  } catch (error: any) {
    console.error("Error restoring quotation:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to restore quotation" },
      { status: 500 }
    );
  }
}
