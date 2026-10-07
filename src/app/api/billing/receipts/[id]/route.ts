import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ClientReceipt from "@/models/ClientReceipt";
import ServicePI from "@/models/ServicePI";
import { requireBillingUser, badRequest, isObjectId, errorResponse } from "@/lib/billingServer";
import { BillingError, recomputeInvoicePayments, recomputePiPayments } from "@/lib/billingDocs";
import { withOptionalTransaction } from "@/lib/transactionHelper";
import { logAuditEntry } from "@/lib/auditLogger";

/**
 * Receipts are never deleted or edited. A wrong entry is voided (with a reason) and re-entered,
 * and only while its PI has not been turned into a tax invoice.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await params;
    if (!isObjectId(id)) return badRequest("Invalid receipt id");
    const body = await req.json();
    if (body.action !== "VOID") return badRequest("Unknown action");
    const reason = String(body.reason || "").trim();
    if (!reason) return badRequest("Give a reason for voiding this receipt");

    const receipt: any = await withOptionalTransaction(async (session) => {
      const opts = session ? { session } : undefined;
      const r: any = await ClientReceipt.findById(id).session(session || null);
      if (!r) throw new BillingError("Receipt not found", 404);
      if (r.status === "VOIDED") throw new BillingError("This receipt is already voided");
      if (r.piId) {
        const pi: any = await ServicePI.findById(r.piId).select("taxInvoiceId piNumber").session(session || null).lean();
        if (pi?.taxInvoiceId) throw new BillingError(`PI ${pi.piNumber} already has a tax invoice; this receipt can no longer be voided.`);
      }
      r.status = "VOIDED";
      r.voidedAt = new Date();
      r.voidedBy = auth.user._id;
      r.voidReason = reason;
      await r.save(opts);
      if (r.piId) await recomputePiPayments(r.piId, session);
      if (r.invoiceId) await recomputeInvoicePayments(r.invoiceId, session);
      return r;
    });

    await logAuditEntry({
      collectionName: "clientreceipts",
      docId: receipt._id,
      action: "VOID",
      changedFields: [
        { field: "status", oldValue: "ACTIVE", newValue: "VOIDED" },
        { field: "voidReason", oldValue: null, newValue: reason },
      ],
      userId: auth.user._id,
    });
    return NextResponse.json({ success: true, message: `Receipt ${receipt.receiptNumber} voided`, data: receipt });
  } catch (error: any) {
    return errorResponse(error, "Failed to void receipt");
  }
}
