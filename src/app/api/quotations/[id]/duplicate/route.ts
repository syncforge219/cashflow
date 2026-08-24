import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Quotation from "@/models/Quotation";
import { generateQuotationNumber } from "@/lib/quotationHelper";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    const original = await Quotation.findById(id).lean();
    if (!original) {
      return NextResponse.json({ success: false, error: "Original quotation not found" }, { status: 404 });
    }

    const companyId = (original as any).companyId || "DEFAULT_COMPANY";
    const newDate = new Date();
    const newQuotationNumber = await generateQuotationNumber(companyId, newDate);

    const duplicateData = {
      ...original,
      _id: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      quotationNumber: newQuotationNumber,
      date: newDate,
      validUntil: undefined,
      status: "DRAFT" as const,
    };

    const newQuotation = await Quotation.create(duplicateData as any);

    return NextResponse.json({
      success: true,
      message: `Quotation duplicated successfully as ${newQuotationNumber}`,
      data: newQuotation,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error duplicating quotation:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
