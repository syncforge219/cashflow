import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
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

    const enqFilter = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { enquiryId: id };
    const enquiry: any = await Enquiry.findOne(enqFilter, null, { includeDeleted: true });

    if (!enquiry) {
      return NextResponse.json({ success: false, message: "Enquiry record not found" }, { status: 404 });
    }

    enquiry.isDeleted = false;
    enquiry.deletedAt = null;
    enquiry.deletedBy = null;
    await enquiry.save();

    await logAuditEntry({
      collectionName: "enquiries",
      docId: enquiry._id,
      action: "RESTORE",
      changedFields: [{ field: "isDeleted", oldValue: true, newValue: false }],
      userId: user._id,
    });

    return NextResponse.json({
      success: true,
      message: "Enquiry record restored successfully.",
      data: enquiry,
    });
  } catch (error: any) {
    console.error("Error restoring enquiry:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to restore enquiry" },
      { status: 500 }
    );
  }
}
