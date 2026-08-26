import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PurchaseOrder from "@/models/PurchaseOrder";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    const po = await PurchaseOrder.findById(id).lean();
    if (!po) {
      return NextResponse.json({ success: false, error: "Purchase Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: po });
  } catch (error: any) {
    console.error("Error fetching purchase order details:", error);
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

    const updated = await PurchaseOrder.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: "Purchase Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Purchase Order updated successfully",
      data: updated,
    });
  } catch (error: any) {
    console.error("Error updating purchase order:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
