import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import DripCampaign from "@/models/DripCampaign";
import mongoose from "mongoose";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { campaignId: id }] }
      : { campaignId: id };

    const updated = await DripCampaign.findOneAndUpdate(query, body, { new: true });
    if (!updated) {
      return NextResponse.json({ success: false, message: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated, message: "Campaign updated successfully!" });
  } catch (error: any) {
    console.error("Error updating drip campaign:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to update campaign" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    const query = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { campaignId: id }] }
      : { campaignId: id };

    const deleted = await DripCampaign.findOneAndDelete(query);
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Campaign deleted successfully!" });
  } catch (error: any) {
    console.error("Error deleting drip campaign:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to delete campaign" }, { status: 500 });
  }
}
