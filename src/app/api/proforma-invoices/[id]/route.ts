import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ProformaInvoice from "@/models/ProformaInvoice";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    const pi = await ProformaInvoice.findById(id).lean();
    if (!pi) {
      return NextResponse.json({ success: false, error: "Proforma Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: pi });
  } catch (error: any) {
    console.error("Error fetching proforma invoice details:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const updated = await ProformaInvoice.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: "Proforma Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Proforma Invoice status updated successfully",
      data: updated,
    });
  } catch (error: any) {
    console.error("Error updating proforma invoice status:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
