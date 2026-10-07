import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Company from "@/models/Company";
import { requireBillingUser, badRequest, isObjectId, errorResponse } from "@/lib/billingServer";
import { logAuditEntry } from "@/lib/auditLogger";
import {
  BUSINESS_TYPES,
  effectiveGstType,
  isValidGstin,
  normalizeGstin,
  stateByCode,
  stateFromGstin,
} from "@/lib/billing";

// Numbers look like PREFIX/2627/0001; GST caps an invoice number at 16 characters, so prefixes max 6
const PREFIX_RE = /^[A-Z0-9-]{0,6}$/;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Updates only the billing settings of a company (GST type, GSTIN, state, business types,
 * tax rates, number series). Other company fields stay with the Companies screen.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = await params;
    if (!isObjectId(id)) return badRequest("Invalid company id");

    const company: any = await Company.findById(id);
    if (!company) return NextResponse.json({ success: false, error: "Company not found" }, { status: 404 });

    const body = await req.json();
    const before = {
      gstType: effectiveGstType(company),
      gst: company.gst,
      stateCode: company.stateCode || "",
      businessTypes: [...(company.businessTypes || [])],
      taxDefaults: { ...(company.taxDefaults?.toObject?.() || company.taxDefaults || {}) },
      invoiceSeries: { ...(company.invoiceSeries?.toObject?.() || company.invoiceSeries || {}) },
    };

    // GST type + GSTIN
    const gstType = body.gstType ?? before.gstType;
    if (gstType !== "GST" && gstType !== "NON_GST") return badRequest("GST type must be GST or Non-GST");
    const gstin = body.gstin !== undefined ? normalizeGstin(body.gstin) : normalizeGstin(company.gst);
    if (gstType === "GST" && !isValidGstin(gstin)) {
      return badRequest("A GST company needs a valid 15-character GSTIN.");
    }
    if (gstType === "NON_GST" && gstin && !isValidGstin(gstin)) {
      return badRequest("GSTIN format is not valid. Leave it empty for a Non-GST company.");
    }

    // State: from the GSTIN when there is one, otherwise as chosen
    let stateCode = String(body.stateCode ?? before.stateCode ?? "");
    const gstinState = stateFromGstin(gstin);
    if (gstinState) stateCode = gstinState.code;
    if (stateCode && !stateByCode(stateCode)) return badRequest("Unknown state");

    // Business types
    let businessTypes = before.businessTypes;
    if (body.businessTypes !== undefined) {
      if (!Array.isArray(body.businessTypes)) return badRequest("businessTypes must be a list");
      businessTypes = Array.from(new Set(body.businessTypes.map(String)));
      const unknown = businessTypes.filter((b: string) => !(BUSINESS_TYPES as readonly string[]).includes(b));
      if (unknown.length) return badRequest(`Unknown business type: ${unknown.join(", ")}`);
    }

    // Tax rates
    const taxIn = body.taxDefaults || {};
    const taxDefaults = {
      cgstRate: Number(taxIn.cgstRate ?? before.taxDefaults.cgstRate ?? 9),
      sgstRate: Number(taxIn.sgstRate ?? before.taxDefaults.sgstRate ?? 9),
      igstRate: Number(taxIn.igstRate ?? before.taxDefaults.igstRate ?? 18),
    };
    for (const [k, v] of Object.entries(taxDefaults)) {
      if (!Number.isFinite(v) || v < 0 || v > 28) return badRequest(`${k} must be between 0 and 28`);
    }
    if (gstType === "GST" && Math.abs(taxDefaults.cgstRate + taxDefaults.sgstRate - taxDefaults.igstRate) > 0.001) {
      return badRequest("CGST + SGST should equal IGST (e.g. 9 + 9 = 18).");
    }

    // Number series: format, and no two companies may share a prefix (invoice numbers must be unique)
    const seriesIn = body.invoiceSeries || {};
    const invoiceSeries = {
      piPrefix: String(seriesIn.piPrefix ?? before.invoiceSeries.piPrefix ?? "").trim().toUpperCase(),
      taxInvoicePrefix: String(seriesIn.taxInvoicePrefix ?? before.invoiceSeries.taxInvoicePrefix ?? "").trim().toUpperCase(),
      nonGstInvoicePrefix: String(seriesIn.nonGstInvoicePrefix ?? before.invoiceSeries.nonGstInvoicePrefix ?? "").trim().toUpperCase(),
    };
    for (const [k, v] of Object.entries(invoiceSeries)) {
      if (!PREFIX_RE.test(v)) return badRequest(`${k}: use up to 6 letters, digits or "-"`);
    }
    const ownPrefixes = Object.values(invoiceSeries).filter(Boolean);
    if (new Set(ownPrefixes).size !== ownPrefixes.length) {
      return badRequest("PI, tax invoice and non-GST invoice series need different prefixes.");
    }
    if (ownPrefixes.length > 0) {
      const regexes = ownPrefixes.map((p) => new RegExp(`^${escapeRegex(p)}$`, "i"));
      const clash: any = await Company.findOne({
        _id: { $ne: company._id },
        $or: [
          { "invoiceSeries.piPrefix": { $in: regexes } },
          { "invoiceSeries.taxInvoicePrefix": { $in: regexes } },
          { "invoiceSeries.nonGstInvoicePrefix": { $in: regexes } },
        ],
      })
        .select("name")
        .lean();
      if (clash) return badRequest(`One of these prefixes is already used by ${clash.name}.`);
    }

    const $set: any = { gstType, stateCode, businessTypes, taxDefaults, invoiceSeries };
    // Only overwrite the stored GSTIN when one was sent, keeping "Not Provided" for untouched records
    if (body.gstin !== undefined) $set.gst = gstin || "Not Provided";

    const updated: any = await Company.findByIdAndUpdate(id, { $set }, { returnDocument: "after", runValidators: true }).lean();

    const changedFields = [
      { field: "gstType", oldValue: before.gstType, newValue: gstType },
      { field: "gst", oldValue: before.gst, newValue: updated.gst },
      { field: "stateCode", oldValue: before.stateCode, newValue: stateCode },
      { field: "businessTypes", oldValue: before.businessTypes, newValue: businessTypes },
      { field: "taxDefaults", oldValue: before.taxDefaults, newValue: taxDefaults },
      { field: "invoiceSeries", oldValue: before.invoiceSeries, newValue: invoiceSeries },
    ].filter((c) => JSON.stringify(c.oldValue ?? null) !== JSON.stringify(c.newValue ?? null));
    if (changedFields.length > 0) {
      await logAuditEntry({ collectionName: "companies", docId: company._id, action: "UPDATE", changedFields, userId: auth.user._id });
    }

    return NextResponse.json({ success: true, message: "Billing settings saved", data: { _id: updated._id } });
  } catch (error: any) {
    return errorResponse(error, "Failed to save billing settings");
  }
}
