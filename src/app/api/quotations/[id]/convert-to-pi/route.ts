import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Quotation from "@/models/Quotation";
import ProformaInvoice from "@/models/ProformaInvoice";
import { generateProformaInvoiceNumber } from "@/lib/proformaInvoiceHelper";
import { numberToIndianWords } from "@/lib/numberToWords";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    const quotation = await Quotation.findById(id).lean();
    if (!quotation) {
      return NextResponse.json({ success: false, error: "Quotation not found" }, { status: 404 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // body is optional
    }

    const companyId = (quotation as any).companyId || "DEFAULT_COMPANY";
    const piDate = new Date();

    let piNumber = body.piNumber?.trim();
    if (!piNumber) {
      const qNum = (quotation.quotationNumber || "").trim();
      if (qNum) {
        if (qNum.includes("-PI/")) {
          piNumber = qNum;
        } else if (qNum.includes("/")) {
          const parts = qNum.split("/");
          if (parts.length >= 3) {
            const prefix = parts[0];
            const year = parts[1];
            const seq = parts.slice(2).join("/");
            piNumber = `${prefix}-PI/${year}/${seq}`;
          } else {
            piNumber = qNum;
          }
        } else {
          piNumber = qNum;
        }
      } else {
        piNumber = await generateProformaInvoiceNumber(companyId, piDate);
      }
    }

    const piData = {
      companyId,
      piNumber,
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber || "",
      category: quotation.category || "PRODUCT",
      customCategoryName: quotation.customCategoryName || "",
      billingCycle: quotation.billingCycle || "ONE_TIME",
      contractPeriod: quotation.contractPeriod || "",
      date: piDate,
      validUntil: quotation.validUntil || undefined,
      poNumber: quotation.poNumber || "",
      customerId: quotation.customerId || undefined,
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
      termsAndConditions: quotation.termsAndConditions || [],
      bankDetails: quotation.bankDetails || {},
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

    const newPI = await ProformaInvoice.create(piData);

    return NextResponse.json({
      success: true,
      message: `Quotation converted to Proforma Invoice ${piNumber} successfully!`,
      data: newPI,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error converting quotation to proforma invoice:", error);
    return NextResponse.json({ success: false, error: error.message || "Conversion failed" }, { status: 500 });
  }
}
