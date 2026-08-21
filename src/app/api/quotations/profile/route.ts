import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import QuotationProfile from "@/models/QuotationProfile";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId") || "DEFAULT_COMPANY";

    let profile = await QuotationProfile.findOne({ companyId }).lean();
    if (!profile) {
      profile = await QuotationProfile.create({ companyId });
    }

    return NextResponse.json({ success: true, data: profile });
  } catch (error: any) {
    console.error("Error fetching quotation profile:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const companyId = body.companyId || "DEFAULT_COMPANY";

    const updatedProfile = await QuotationProfile.findOneAndUpdate(
      { companyId },
      { $set: body },
      { new: true, upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: "Company quotation settings updated successfully",
      data: updatedProfile,
    });
  } catch (error: any) {
    console.error("Error updating quotation profile:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
