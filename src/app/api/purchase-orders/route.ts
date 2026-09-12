import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import PurchaseOrder from "@/models/PurchaseOrder";
import QuotationProfile from "@/models/QuotationProfile";
import { numberToIndianWords } from "@/lib/numberToWords";
import { generatePurchaseOrderNumber } from "@/lib/purchaseOrderHelper";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId") || "DEFAULT_COMPANY";
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status") || "ALL";
    const billingCycle = searchParams.get("billingCycle") || "ALL";
    const customer = searchParams.get("customer") || "ALL";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    const query: any = { companyId };

    if (status !== "ALL") {
      query.status = status;
    }

    if (billingCycle !== "ALL") {
      query.billingCycle = billingCycle;
    }

    if (customer !== "ALL") {
      const escaped = customer.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { customerName: { $regex: `^${escaped}$`, $options: "i" } },
        { supplierName: { $regex: `^${escaped}$`, $options: "i" } },
      ];
    }

    if (q) {
      const searchConditions = [
        { poNumber: { $regex: q, $options: "i" } },
        { quotationNumber: { $regex: q, $options: "i" } },
        { customerName: { $regex: q, $options: "i" } },
        { supplierName: { $regex: q, $options: "i" } },
        { supplierAddress: { $regex: q, $options: "i" } },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    const skip = (page - 1) * limit;

    const [purchaseOrders, totalCount, allPOsForStats, distinctCustomers, distinctSuppliers] = await Promise.all([
      PurchaseOrder.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      PurchaseOrder.countDocuments(query),
      PurchaseOrder.find({ companyId }).select("status grandTotal date createdAt").lean(),
      PurchaseOrder.distinct("customerName", { companyId }),
      PurchaseOrder.distinct("supplierName", { companyId }),
    ]);

    const combinedCusts = [...(distinctCustomers || []), ...(distinctSuppliers || [])];
    const cleanCustomers = combinedCusts
      .filter((c: any) => typeof c === "string" && c.trim().length > 0)
      .map((c: string) => c.trim())
      .filter((c: string, idx: number, arr: string[]) => arr.indexOf(c) === idx)
      .sort((a: string, b: string) => a.localeCompare(b));

    let totalVal = 0;
    let currentMonthVal = 0;
    let draftCount = 0;
    let issuedCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    allPOsForStats.forEach((po: any) => {
      const val = Number(po.grandTotal) || 0;
      totalVal += val;

      const poDate = new Date(po.date || po.createdAt);
      if (poDate >= startOfMonth) {
        currentMonthVal += val;
      }

      const st = po.status;
      if (st === "DRAFT") draftCount++;
      else if (st === "ISSUED") issuedCount++;
      else if (st === "COMPLETED") completedCount++;
      else if (st === "CANCELLED") cancelledCount++;
    });

    const stats = {
      totalPOs: allPOsForStats.length,
      draftPOs: draftCount,
      issuedPOs: issuedCount,
      completedPOs: completedCount,
      cancelledPOs: cancelledCount,
      totalValue: totalVal,
      currentMonthValue: currentMonthVal,
    };

    return NextResponse.json({
      success: true,
      data: purchaseOrders,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats,
      customers: cleanCustomers,
    });
  } catch (error: any) {
    console.error("Error fetching purchase orders:", error);
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

    const poDate = body.date ? new Date(body.date) : new Date();
    const generatedNum = await generatePurchaseOrderNumber(companyId, poDate);
    const poNumber = body.poNumber?.trim() || generatedNum;

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
        unit: item.unit !== undefined && item.unit !== null ? String(item.unit).trim() : "",
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

    const newPO = await PurchaseOrder.create({
      companyId,
      poNumber,
      quotationNumber: body.quotationNumber?.trim() || "",
      category: body.category || "PRODUCT",
      customCategoryName: body.customCategoryName?.trim() || "",
      billingCycle: body.billingCycle || "ONE_TIME",
      contractPeriod: body.contractPeriod?.trim() || "",
      date: poDate,
      supplierName: body.supplierName?.trim() || "",
      supplierAddress: body.supplierAddress?.trim() || "",
      supplierGstin: body.supplierGstin?.trim() || "",
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
      status: body.status || ("ISSUED" as const),
      createdBy: body.createdBy || "Admin",

      // Snapshot company profile details (prefer user-customized details if passed)
      companyName: body.companyName !== undefined && body.companyName !== "" ? body.companyName : ((profile as any)?.name || "SICCES PRIVATE LIMITED"),
      companyLogo: body.companyLogo !== undefined ? body.companyLogo : ((profile as any)?.logo || ""),
      companyGstin: body.companyGstin !== undefined ? body.companyGstin : ((profile as any)?.gstin || ""),
      companyCin: body.companyCin !== undefined ? body.companyCin : ((profile as any)?.cin || ""),
      companyDescription: body.companyDescription !== undefined ? body.companyDescription : ((profile as any)?.description || ""),
      companyAddress: body.companyAddress !== undefined ? body.companyAddress : ((profile as any)?.address || ""),
      companyPhone: body.companyPhone !== undefined ? body.companyPhone : ((profile as any)?.phone || ""),
      companyEmail: body.companyEmail !== undefined ? body.companyEmail : ((profile as any)?.email || ""),
      companyWebsite: body.companyWebsite !== undefined ? body.companyWebsite : ((profile as any)?.website || ""),
      companyWorksAddress: body.companyWorksAddress !== undefined ? body.companyWorksAddress : ((profile as any)?.worksAddress || ""),
      authorizedSignatory: body.authorizedSignatory !== undefined ? body.authorizedSignatory : ((profile as any)?.authorizedSignatory || "AUTHORISED SIGNATORY"),
      signatureImage: body.signatureImage !== undefined ? body.signatureImage : ((profile as any)?.signatureImage || ""),
      stampImage: body.stampImage !== undefined ? body.stampImage : ((profile as any)?.stampImage || ""),
      bankQrImage: body.bankQrImage !== undefined ? body.bankQrImage : ((profile as any)?.bankQrImage || ""),
    });

    return NextResponse.json({
      success: true,
      message: "Purchase Order created successfully",
      data: newPO,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating purchase order:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const targetId = body.id || body._id;

    if (!targetId) {
      return NextResponse.json({ success: false, error: "Purchase Order ID is required for update" }, { status: 400 });
    }

    const updatePayload: any = {
      ...(body.category && { category: body.category }),
      ...(body.customCategoryName !== undefined && { customCategoryName: body.customCategoryName.trim() }),
      ...(body.billingCycle && { billingCycle: body.billingCycle }),
      ...(body.contractPeriod !== undefined && { contractPeriod: body.contractPeriod.trim() }),
      ...(body.date && { date: new Date(body.date) }),
      ...(body.validUntil && { validUntil: new Date(body.validUntil) }),
      ...(body.poNumber !== undefined && { poNumber: body.poNumber.trim() }),
      ...(body.customerName && { customerName: body.customerName.trim() }),
      ...(body.supplierName !== undefined && { supplierName: body.supplierName.trim() }),
      ...(body.consigneeInfo !== undefined && { consigneeInfo: body.consigneeInfo.trim() }),
      ...(body.customerAddress !== undefined && { customerAddress: body.customerAddress.trim() }),
      ...(body.customerGstin !== undefined && { customerGstin: body.customerGstin.trim().toUpperCase() }),
      ...(body.deliveryLocation !== undefined && { deliveryLocation: body.deliveryLocation.trim() }),
      ...(body.items && { items: body.items }),
      ...(body.subtotal !== undefined && { subtotal: body.subtotal }),
      ...(body.discount !== undefined && { discount: body.discount }),
      ...(body.gstRate !== undefined && { gstRate: body.gstRate }),
      ...(body.gstAmount !== undefined && { gstAmount: body.gstAmount }),
      ...(body.transportCharges !== undefined && { transportCharges: body.transportCharges }),
      ...(body.transportText !== undefined && { transportText: body.transportText }),
      ...(body.additionalCharges !== undefined && { additionalCharges: body.additionalCharges }),
      ...(body.grandTotal !== undefined && { grandTotal: body.grandTotal }),
      ...(body.amountInWords !== undefined && { amountInWords: body.amountInWords }),
      ...(body.termsAndConditions !== undefined && { termsAndConditions: body.termsAndConditions }),
      ...(body.status && { status: body.status }),
      ...(body.companyName !== undefined && { companyName: body.companyName }),
      ...(body.companyLogo !== undefined && { companyLogo: body.companyLogo }),
      ...(body.companyGstin !== undefined && { companyGstin: body.companyGstin }),
      ...(body.companyCin !== undefined && { companyCin: body.companyCin }),
      ...(body.companyDescription !== undefined && { companyDescription: body.companyDescription }),
      ...(body.companyAddress !== undefined && { companyAddress: body.companyAddress }),
      ...(body.companyPhone !== undefined && { companyPhone: body.companyPhone }),
      ...(body.companyEmail !== undefined && { companyEmail: body.companyEmail }),
      ...(body.companyWebsite !== undefined && { companyWebsite: body.companyWebsite }),
      ...(body.authorizedSignatory !== undefined && { authorizedSignatory: body.authorizedSignatory }),
      ...(body.signatureImage !== undefined && { signatureImage: body.signatureImage }),
      ...(body.stampImage !== undefined && { stampImage: body.stampImage }),
      ...(body.bankQrImage !== undefined && { bankQrImage: body.bankQrImage }),
    };

    const updatedPO = await PurchaseOrder.findByIdAndUpdate(targetId, { $set: updatePayload }, { new: true });

    return NextResponse.json({
      success: true,
      message: "Purchase Order updated successfully",
      data: updatedPO,
    });
  } catch (error: any) {
    console.error("Error updating purchase order:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Purchase Order ID is required" }, { status: 400 });
    }

    await PurchaseOrder.findByIdAndDelete(id);
    return NextResponse.json({ success: true, message: "Purchase Order deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting purchase order:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
