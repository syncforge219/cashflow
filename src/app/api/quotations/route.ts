import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Quotation from "@/models/Quotation";
import QuotationProfile from "@/models/QuotationProfile";
import { numberToIndianWords } from "@/lib/numberToWords";
import { generateQuotationNumber } from "@/lib/quotationHelper";

const parseItemQty = (item: any): number => {
  const q = item.quantity;
  const r = Number(item.rate) || 0;
  const storedAmt = Number(item.amount) || 0;

  if (typeof q === "number" && q > 0) return q;
  if (q && String(q).trim() !== "0" && String(q).trim() !== "") {
    const str = String(q).trim().toLowerCase();
    const match = str.match(/[\d.]+/);
    if (match && parseFloat(match[0]) > 0) return parseFloat(match[0]);
  }
  if (storedAmt > 0 && r > 0) {
    return Math.round(storedAmt / r);
  }
  const combinedText = `${item.name || ""} ${item.description || ""}`.toLowerCase();
  const digitPattern = combinedText.match(/(\d+)\s*(day|days|hour|hours|month|months|year|years|seat|seats|unit|units|pc|pcs|kg|mtr)/);
  if (digitPattern && parseFloat(digitPattern[1]) > 0) {
    return parseFloat(digitPattern[1]);
  }
  const wordMap: Record<string, number> = {
    "ten": 10, "nine": 9, "eight": 8, "seven": 7, "six": 6, "five": 5,
    "four": 4, "three": 3, "two": 2, "one": 1, "double": 2, "single": 1
  };
  for (const [w, n] of Object.entries(wordMap)) {
    const regex = new RegExp(`\\b${w}\\b`, "i");
    if (regex.test(combinedText)) return n;
  }
  if (r > 0) return 1;
  return 0;
};

const computeQuotationGrandTotal = (qDoc: any): number => {
  if (Number(qDoc.grandTotal) > 0) return Number(qDoc.grandTotal);
  const items = qDoc.items || [];
  if (items.length === 0) return 0;

  const subtotal = items.reduce((sum: number, it: any) => {
    const qN = parseItemQty(it);
    const rN = Number(it.rate) || 0;
    const a = Number(it.amount) > 0 ? Number(it.amount) : qN * rN;
    return sum + a;
  }, 0);

  const gstRate = qDoc.gstRate !== undefined && qDoc.gstRate !== null ? Number(qDoc.gstRate) : 18;
  const gstAmount = Math.round((subtotal * gstRate) / 100);
  const transportCharges = Number(qDoc.transportCharges) || 0;
  const additionalCharges = Number(qDoc.additionalCharges) || 0;
  const discount = Number(qDoc.discount) || 0;

  return Math.round(Math.max(0, subtotal - discount) + gstAmount + transportCharges + additionalCharges);
};

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId") || "DEFAULT_COMPANY";
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status") || "ALL";
    const category = searchParams.get("category") || "ALL";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const query: any = { companyId };

    if (status !== "ALL") {
      query.status = status;
    }

    if (category !== "ALL") {
      query.category = category;
    }

    if (q) {
      query.$or = [
        { quotationNumber: { $regex: q, $options: "i" } },
        { customerName: { $regex: q, $options: "i" } },
        { poNumber: { $regex: q, $options: "i" } },
        { deliveryLocation: { $regex: q, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [quotations, totalCount, allQuotationsForStats] = await Promise.all([
      Quotation.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Quotation.countDocuments(query),
      Quotation.find({ companyId }).select("status grandTotal items gstRate transportCharges discount date createdAt").lean(),
    ]);

    // Compute Stats
    let totalVal = 0;
    let currentMonthVal = 0;
    let draftCount = 0;
    let sentCount = 0;
    let acceptedCount = 0;
    let rejectedCount = 0;
    let expiredCount = 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    allQuotationsForStats.forEach((qItem: any) => {
      const val = computeQuotationGrandTotal(qItem);
      totalVal += val;

      const qDate = new Date(qItem.date || qItem.createdAt);
      if (qDate >= startOfMonth) {
        currentMonthVal += val;
      }

      const st = qItem.status;
      if (st === "DRAFT") draftCount++;
      else if (st === "SENT") sentCount++;
      else if (st === "ACCEPTED") acceptedCount++;
      else if (st === "REJECTED") rejectedCount++;
      else if (st === "EXPIRED") expiredCount++;
    });

    const processedQuotations = quotations.map((qItem: any) => ({
      ...qItem,
      grandTotal: computeQuotationGrandTotal(qItem),
    }));

    const stats = {
      totalQuotations: allQuotationsForStats.length,
      draftQuotations: draftCount,
      sentQuotations: sentCount,
      acceptedQuotations: acceptedCount,
      rejectedQuotations: rejectedCount,
      expiredQuotations: expiredCount,
      totalValue: totalVal,
      currentMonthValue: currentMonthVal,
    };

    return NextResponse.json({
      success: true,
      data: processedQuotations,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats,
    });
  } catch (error: any) {
    console.error("Error fetching quotations:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const companyId = body.companyId || "DEFAULT_COMPANY";

    // Fetch Company Profile snapshot
    let profile = await QuotationProfile.findOne({ companyId }).lean();
    if (!profile) {
      profile = await QuotationProfile.create({ companyId });
    }

    const qDate = body.date ? new Date(body.date) : new Date();
    const generatedNum = await generateQuotationNumber(companyId, qDate);
    const quotationNumber = body.quotationNumber?.trim() || generatedNum;

    // Server-side Recalculate Items & Totals
    const items = Array.isArray(body.items) ? body.items : [];
    let calculatedSubtotal = 0;

    const processedItems = items.map((item: any) => {
      const qty = Math.max(0, Number(item.quantity) || 0);
      const rate = Math.max(0, Number(item.rate) || 0);
      const amt = qty * rate;
      calculatedSubtotal += amt;

      return {
        productId: item.productId || undefined,
        name: item.name || item.productName || "Product",
        description: item.description || "",
        quantity: qty,
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

    const newQuotation = await Quotation.create({
      companyId,
      category: body.category || "PRODUCT",
      billingCycle: body.billingCycle || "ONE_TIME",
      contractPeriod: body.contractPeriod?.trim() || "",
      quotationNumber,
      date: qDate,
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
      transportText: body.transportText?.trim() || (transportCharges > 0 ? `₹${transportCharges}` : "included"),
      additionalCharges,
      grandTotal: calculatedGrandTotal,
      amountInWords,
      termsAndConditions: Array.isArray(body.termsAndConditions) && body.termsAndConditions.length > 0
        ? body.termsAndConditions
        : ((profile as any)?.defaultTerms || []),
      bankDetails: body.bankDetails || (profile as any)?.bankDetails || {},
      status: body.status || "DRAFT",
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
      message: "Quotation created successfully",
      data: newQuotation,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating quotation:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { id, _id } = body;
    const targetId = id || _id;

    if (!targetId) {
      return NextResponse.json({ success: false, error: "Quotation ID is required for update" }, { status: 400 });
    }

    const existingQuotation = await Quotation.findById(targetId);
    if (!existingQuotation) {
      return NextResponse.json({ success: false, error: "Quotation not found" }, { status: 404 });
    }

    const items = Array.isArray(body.items) ? body.items : existingQuotation.items;
    let calculatedSubtotal = 0;

    const processedItems = items.map((item: any) => {
      const qty = Math.max(0, Number(item.quantity) || 0);
      const rate = Math.max(0, Number(item.rate) || 0);
      const amt = qty * rate;
      calculatedSubtotal += amt;

      return {
        productId: item.productId || undefined,
        name: item.name || item.productName || "Product",
        description: item.description || "",
        quantity: qty,
        unit: item.unit || "mtr",
        rate: rate,
        gstRate: Number(item.gstRate) !== undefined ? Number(item.gstRate) : 18,
        amount: amt,
      };
    });

    const gstRate = body.gstRate !== undefined && body.gstRate !== null ? Number(body.gstRate) : (existingQuotation.gstRate !== undefined ? existingQuotation.gstRate : 18);
    const discount = body.discount !== undefined ? Math.max(0, Number(body.discount) || 0) : existingQuotation.discount;
    const transportCharges = body.transportCharges !== undefined ? Math.max(0, Number(body.transportCharges) || 0) : existingQuotation.transportCharges;
    const additionalCharges = body.additionalCharges !== undefined ? Math.max(0, Number(body.additionalCharges) || 0) : existingQuotation.additionalCharges;

    const taxableBase = Math.max(0, calculatedSubtotal - discount);
    const calculatedGstAmount = (taxableBase * gstRate) / 100;
    const calculatedGrandTotal = Math.round(taxableBase + calculatedGstAmount + transportCharges + additionalCharges);

    const amountInWords = numberToIndianWords(calculatedGrandTotal);

    const updatePayload: any = {
      ...(body.category && { category: body.category }),
      ...(body.billingCycle && { billingCycle: body.billingCycle }),
      ...(body.contractPeriod !== undefined && { contractPeriod: body.contractPeriod.trim() }),
      ...(body.date && { date: new Date(body.date) }),
      ...(body.validUntil && { validUntil: new Date(body.validUntil) }),
      ...(body.poNumber !== undefined && { poNumber: body.poNumber.trim() }),
      ...(body.customerName && { customerName: body.customerName.trim() }),
      ...(body.consigneeInfo !== undefined && { consigneeInfo: body.consigneeInfo.trim() }),
      ...(body.customerAddress !== undefined && { customerAddress: body.customerAddress.trim() }),
      ...(body.customerGstin !== undefined && { customerGstin: body.customerGstin.trim().toUpperCase() }),
      ...(body.deliveryLocation !== undefined && { deliveryLocation: body.deliveryLocation.trim() }),
      items: processedItems,
      subtotal: calculatedSubtotal,
      discount,
      gstRate,
      gstAmount: calculatedGstAmount,
      transportCharges,
      transportText: body.transportText?.trim() || (transportCharges > 0 ? `₹${transportCharges}` : "included"),
      additionalCharges,
      grandTotal: calculatedGrandTotal,
      amountInWords,
      ...(body.termsAndConditions && { termsAndConditions: body.termsAndConditions }),
      ...(body.bankDetails && { bankDetails: body.bankDetails }),
      ...(body.status && { status: body.status }),
    };

    const updatedQuotation = await Quotation.findByIdAndUpdate(targetId, { $set: updatePayload }, { new: true });

    return NextResponse.json({
      success: true,
      message: "Quotation updated successfully",
      data: updatedQuotation,
    });
  } catch (error: any) {
    console.error("Error updating quotation:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Quotation ID is required" }, { status: 400 });
    }

    await Quotation.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: "Quotation deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting quotation:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
