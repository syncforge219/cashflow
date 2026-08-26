import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Quotation from "@/models/Quotation";
import PurchaseOrder from "@/models/PurchaseOrder";
import { generatePurchaseOrderNumber } from "@/lib/purchaseOrderHelper";
import { numberToIndianWords } from "@/lib/numberToWords";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const quotation = await Quotation.findById(id).lean();
    if (!quotation) {
      return NextResponse.json({ success: false, error: "Quotation not found" }, { status: 404 });
    }

    const companyId = (quotation as any).companyId || "DEFAULT_COMPANY";
    const poDate = new Date();
    const poNumber = await generatePurchaseOrderNumber(companyId, poDate);

    const supplierAddress = (body.supplierAddress || "").trim();
    const supplierName = (body.supplierName || "").trim();
    const supplierGstin = (body.supplierGstin || "").trim();

    const poData = {
      companyId,
      poNumber,
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber || "",
      category: quotation.category || "PRODUCT",
      customCategoryName: quotation.customCategoryName || "",
      billingCycle: quotation.billingCycle || "ONE_TIME",
      contractPeriod: quotation.contractPeriod || "",
      date: poDate,
      supplierName,
      supplierAddress,
      supplierGstin,
      customerName: quotation.customerName || "Customer",
      consigneeInfo: quotation.consigneeInfo || "",
      customerAddress: quotation.customerAddress || "",
      customerGstin: quotation.customerGstin || "",
      deliveryLocation: quotation.deliveryLocation || "",
      items: quotation.items || [],
      subtotal: quotation.subtotal || 0,
      discount: quotation.discount || 0,
      gstRate: quotation.gstRate || 18,
      gstAmount: quotation.gstAmount || 0,
      transportCharges: quotation.transportCharges || 0,
      transportText: quotation.transportText || "",
      additionalCharges: quotation.additionalCharges || 0,
      grandTotal: quotation.grandTotal || 0,
      amountInWords: quotation.amountInWords || numberToIndianWords(quotation.grandTotal || 0),
      status: "ISSUED" as const,
      createdBy: quotation.createdBy || "System",

      // Snapshot company branding details
      companyName: quotation.companyName || "",
      companyLogo: quotation.companyLogo || "",
      companyGstin: quotation.companyGstin || "",
      companyCin: quotation.companyCin || "",
      companyDescription: quotation.companyDescription || "",
      companyAddress: quotation.companyAddress || "",
      companyPhone: quotation.companyPhone || "",
      companyEmail: quotation.companyEmail || "",
      companyWebsite: quotation.companyWebsite || "",
      companyWorksAddress: quotation.companyWorksAddress || "",
      authorizedSignatory: quotation.authorizedSignatory || "AUTHORISED SIGNATORY",
      signatureImage: quotation.signatureImage || "",
      stampImage: quotation.stampImage || "",
    };

    const newPO = await PurchaseOrder.create(poData);

    return NextResponse.json({
      success: true,
      message: `Quotation converted to Purchase Order ${poNumber} successfully!`,
      data: newPO,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error converting quotation to purchase order:", error);
    return NextResponse.json({ success: false, error: error.message || "Conversion failed" }, { status: 500 });
  }
}
