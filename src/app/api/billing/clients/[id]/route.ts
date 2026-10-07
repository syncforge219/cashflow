import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import QuotationCustomer from "@/models/QuotationCustomer";
import { requireBillingUser, badRequest, isObjectId, errorResponse } from "@/lib/billingServer";
import { parseBillingClientBody } from "@/lib/billingClientRules";
import { logAuditEntry } from "@/lib/auditLogger";
import { escapeRegex } from "@/lib/helper";

/**
 * Updates a client, and also turns an existing quotation customer into a billing client.
 * Billing clients are never deleted: set clientStatus to INACTIVE instead, so invoice history keeps its client.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = await params;
    if (!isObjectId(id)) return badRequest("Invalid client id");

    const existing: any = await QuotationCustomer.findById(id).lean();
    if (!existing) return NextResponse.json({ success: false, error: "Client not found" }, { status: 404 });

    const { data, error } = await parseBillingClientBody(await req.json(), existing);
    if (error) return badRequest(error);

    if (data.name && data.name.toLowerCase() !== String(existing.name || "").toLowerCase()) {
      const dupe = await QuotationCustomer.exists({ _id: { $ne: id }, name: new RegExp(`^${escapeRegex(data.name)}$`, "i") });
      if (dupe) return badRequest(`Another client is already named '${data.name}'.`);
    }
    if (data.gstin && data.gstin !== existing.gstin) {
      const dupe: any = await QuotationCustomer.findOne({ _id: { $ne: id }, gstin: data.gstin }).select("name").lean();
      if (dupe) return badRequest(`GSTIN ${data.gstin} is already used by '${dupe.name}'.`);
    }

    const updated: any = await QuotationCustomer.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after", runValidators: true })
      .populate("billingCompanyIds", "name gstType gst")
      .populate("defaultBillingCompanyId", "name")
      .lean();

    const idList = (v: any) => (Array.isArray(v) ? v.map((x: any) => String(x?._id || x)).sort() : v);
    const changedFields = Object.keys(data)
      .map((k) => ({
        field: k,
        oldValue: k === "billingCompanyIds" ? idList(existing[k]) : existing[k] ?? null,
        newValue: k === "billingCompanyIds" ? idList(data[k]) : data[k] ?? null,
      }))
      .filter((c) => JSON.stringify(c.oldValue) !== JSON.stringify(c.newValue));
    if (changedFields.length > 0) {
      await logAuditEntry({ collectionName: "quotationcustomers", docId: existing._id, action: "UPDATE", changedFields, userId: auth.user._id });
    }

    return NextResponse.json({
      success: true,
      message: existing.isBillingClient ? "Client updated" : "Billing enabled for this customer",
      data: updated,
    });
  } catch (error: any) {
    return errorResponse(error, "Failed to update client");
  }
}
