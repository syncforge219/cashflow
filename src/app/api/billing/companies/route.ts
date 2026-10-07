import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Company from "@/models/Company";
import BankAccount from "@/models/BankAccount";
import { requireBillingUser, errorResponse } from "@/lib/billingServer";
import { effectiveGstType, normalizeGstin, DEFAULT_TAX } from "@/lib/billing";

/** Companies with their billing settings, for the Billing Setup screen and billing dropdowns. */
export async function GET() {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;

    const companies: any[] = await Company.find({})
      .select("name legalName gst pan address status brands gstType stateCode businessTypes taxDefaults invoiceSeries")
      .sort({ name: 1 })
      .lean();

    const bankCounts = await BankAccount.aggregate([
      { $match: { isDeleted: { $ne: true }, status: "ACTIVE" } },
      { $group: { _id: "$companyId", count: { $sum: 1 } } },
    ]);
    const countByCompany = new Map(bankCounts.map((b: any) => [String(b._id), b.count]));

    const data = companies.map((c) => ({
      _id: c._id,
      name: c.name,
      legalName: c.legalName || c.name,
      gstin: normalizeGstin(c.gst),
      pan: c.pan && c.pan !== "Not Provided" ? c.pan : "",
      address: c.address || "",
      status: c.status || "ACTIVE",
      brands: c.brands || [],
      gstType: effectiveGstType(c),
      gstTypeConfirmed: c.gstType === "GST" || c.gstType === "NON_GST",
      stateCode: c.stateCode || "",
      businessTypes: c.businessTypes || [],
      taxDefaults: { ...DEFAULT_TAX, ...(c.taxDefaults || {}) },
      invoiceSeries: {
        piPrefix: c.invoiceSeries?.piPrefix || "",
        taxInvoicePrefix: c.invoiceSeries?.taxInvoicePrefix || "",
        nonGstInvoicePrefix: c.invoiceSeries?.nonGstInvoicePrefix || "",
      },
      activeBankAccounts: countByCompany.get(String(c._id)) || 0,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return errorResponse(error, "Failed to load companies");
  }
}
