import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Company from "@/models/Company";
import { sendWhatsAppCompanyCapacityAlert } from "@/lib/msg91";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const deleted = await Company.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Company deleted successfully" });
  } catch (error: any) {
    console.error("Delete Company Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete company" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();
    const updateData: any = { ...body };

    if (updateData.name) {
      updateData.name = updateData.name.toUpperCase().trim();
    }
    if (updateData.legalName) {
      updateData.legalName = updateData.legalName.toUpperCase().trim();
    }
    if (Array.isArray(updateData.brands)) {
      updateData.brands = updateData.brands.map((b: string) => b.toUpperCase().trim());
    }

    if (updateData.annualCapacityCap !== undefined) {
      updateData.annualCapacityCap = Number(updateData.annualCapacityCap);
    }
    if (updateData.collectedRevenue !== undefined) {
      updateData.collectedRevenue = Number(updateData.collectedRevenue);
    }

    const updated = await Company.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const cap = updated.annualCapacityCap || 1949999;
    const collected = updated.collectedRevenue || 0;
    const pct = cap > 0 ? (collected / cap) * 100 : 0;

    if (pct >= 95) {
      sendWhatsAppCompanyCapacityAlert({
        companyName: updated.name,
        collectedRevenue: collected,
        annualCapacityCap: cap,
        capacityPercentage: pct,
      }).catch((err) => console.error("[Company PUT API] WhatsApp 95% Capacity Alert error:", err));
    }

    return NextResponse.json({ success: true, company: updated });
  } catch (error: any) {
    console.error("Update Company Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update company" }, { status: 500 });
  }
}
