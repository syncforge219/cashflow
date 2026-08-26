import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ProformaInvoice from "@/models/ProformaInvoice";
import QuotationProfile from "@/models/QuotationProfile";
import { numberToIndianWords } from "@/lib/numberToWords";
import { generateProformaInvoiceNumber } from "@/lib/proformaInvoiceHelper";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId") || "DEFAULT_COMPANY";
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status") || "ALL";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const query: any = { companyId };

    if (status !== "ALL") {
      query.status = status;
    }

    if (q) {
      query.$or = [
        { piNumber: { $regex: q, $options: "i" } },
        { quotationNumber: { $regex: q, $options: "i" } },
        { customerName: { $regex: q, $options: "i" } },
        { poNumber: { $regex: q, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [proformaInvoices, totalCount, allPIsForStats] = await Promise.all([
      ProformaInvoice.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ProformaInvoice.countDocuments(query),
      ProformaInvoice.find({ companyId }).select("status grandTotal date createdAt").lean(),
    ]);

    let totalVal = 0;
    let currentMonthVal = 0;
    let draftCount = 0;
    let issuedCount = 0;
    let paidCount = 0;
    let cancelledCount = 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    allPIsForStats.forEach((pi: any) => {
      const val = Number(pi.grandTotal) || 0;
      totalVal += val;

      const piDate = new Date(pi.date || pi.createdAt);
      if (piDate >= startOfMonth) {
        currentMonthVal += val;
      }

      const st = pi.status;
      if (st === "DRAFT") draftCount++;
      else if (st === "ISSUED") issuedCount++;
      else if (st === "PAID") paidCount++;
      else if (st === "CANCELLED") cancelledCount++;
    });

    const stats = {
      totalPIs: allPIsForStats.length,
      draftPIs: draftCount,
      issuedPIs: issuedCount,
      paidPIs: paidCount,
      cancelledPIs: cancelledCount,
      totalValue: totalVal,
      currentMonthValue: currentMonthVal,
    };

    return NextResponse.json({
      success: true,
      data: proformaInvoices,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats,
    });
  } catch (error: any) {
    console.error("Error fetching proforma invoices:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const companyId = body.companyId || "DEFAULT_COMPANY";

    let profile = await QuotationProfile.findOne({ companyId }).lean();
    if (!profile) {
      profile = await QuotationProfile.create({ companyId });
    }

    const piDate = body.date ? new Date(body.date) : new Date();
    const generatedNum = await generateProformaInvoiceNumber(companyId, piDate);
    const piNumber = body.piNumber?.trim() || generatedNum;

    const items = Array.isArray(body.items) ? body.items : [];
    let calculatedSubtotal = 0;

    const processedItems = items.map((item: any) => {
      const qtyNum = Number(item.quantity) || 1;
      const rate = Math.max(0, Number(item.rate) || 0);
      const amt = Number(item.amount) > 0 ? Number(item.amount) : Math.round(qtyNum * rate);
      calculatedSubtotal += amt;

      return {
        productId: item.productId || undefined,
        name: item.name || item.productName || "Product",
        description: item.description || "",
        quantity: item.quantity || 1,
        unit: item.unit || "mtr",
        rate: rate,
        gstRate: Number(item.gstRate) !== undefined ? Number(item.gstRate) : 18,
        amount: amt,
      };
    });

    const gstRate = body.gstRate !== undefined && body.gstRate !== null ? Number(body.gstRate) : 18;
    const discount = Math.max(0, Number(body.discount) || 0);
    const transportCharges = Math.max(0, Number(body.transportCharges) || 0);
    const additionalCharges = Math.max(0, Number(body.additionalCharges) || 0);

    const taxableBase = Math.max(0, calculatedSubtotal - discount);
    const calculatedGstAmount = (taxableBase * gstRate) / 100;
    const calculatedGrandTotal = Math.round(taxableBase + calculatedGstAmount + transportCharges + additionalCharges);

    const amountInWords = numberToIndianWords(calculatedGrandTotal);

    const newPI = await ProformaInvoice.create({
      companyId,
      piNumber,
      quotationNumber: body.quotationNumber?.trim() || "",
      category: body.category || "PRODUCT",
      customCategoryName: body.customCategoryName?.trim() || "",
      billingCycle: body.billingCycle || "ONE_TIME",
      contractPeriod: body.contractPeriod?.trim() || "",
      date: piDate,
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
      poNumber: body.poNumber?.trim() || "",
      customerId: body.customerId || undefined,
      customerName: body.customerName?.trim() || "Customer",
      consigneeInfo: body.consigneeInfo?.trim() || body.customerName?.trim() || "",
      customerAddress: body.customerAddress?.trim() || "",
      customerGstin: body.customerGstin?.trim()?.toUpperCase() || "",
      deliveryLocation: body.deliveryLocation?.trim() || "",
      items: processedItems,
      subtotal: calculatedSubtotal,
      discount,
      gstRate,
      gstAmount: calculatedGstAmount,
      transportCharges,
      transportText: body.transportText?.trim() || "",
      additionalCharges,
      grandTotal: calculatedGrandTotal,
      amountInWords,
      termsAndConditions: Array.isArray(body.termsAndConditions) ? body.termsAndConditions : ((profile as any)?.defaultTerms || []),
      bankDetails: body.bankDetails || (profile as any)?.bankDetails || {},
      status: body.status || ("ISSUED" as const),
      createdBy: body.createdBy || "Admin",

      // Snapshot company profile details
      companyName: (profile as any)?.name || "AARAM PLASTICS PVT. LTD.",
      companyLogo: (profile as any)?.logo || "",
      companyGstin: (profile as any)?.gstin || "",
      companyCin: (profile as any)?.cin || "",
      companyDescription: (profile as any)?.description || "",
      companyAddress: (profile as any)?.address || "",
      companyPhone: (profile as any)?.phone || "",
      companyEmail: (profile as any)?.email || "",
      companyWebsite: (profile as any)?.website || "",
      companyWorksAddress: (profile as any)?.worksAddress || "",
      authorizedSignatory: (profile as any)?.authorizedSignatory || "AUTHORISED SIGNATORY",
      signatureImage: (profile as any)?.signatureImage || "",
      stampImage: (profile as any)?.stampImage || "",
    });

    return NextResponse.json({
      success: true,
      message: "Proforma Invoice created successfully",
      data: newPI,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating proforma invoice:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Proforma Invoice ID is required" }, { status: 400 });
    }

    await ProformaInvoice.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: "Proforma Invoice deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting proforma invoice:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
