import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import LeadSource from "@/models/LeadSource";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ success: false, message: "Invalid ID" }, { status: 400 });
    }

    const deleted = await LeadSource.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Lead source not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Lead source deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/lead-sources/[id] error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to delete lead source" },
      { status: 500 }
    );
  }
}
