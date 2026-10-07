import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ServicePI from "@/models/ServicePI";
import ClientReceipt from "@/models/ClientReceipt";
import { requireBillingUser, badRequest, isObjectId, errorResponse } from "@/lib/billingServer";
import { BillingError, getPrintBankDetails, requirePeriod, rupeesToPaiseStrict } from "@/lib/billingDocs";
import { computeTax } from "@/lib/billingTax";
import { logAuditEntry } from "@/lib/auditLogger";

/** One PI with its receipts and the bank details to print on it. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await params;
    if (!isObjectId(id)) return badRequest("Invalid PI id");

    const pi: any = await ServicePI.findById(id).lean();
    if (!pi) return NextResponse.json({ success: false, error: "PI not found" }, { status: 404 });
    const [receipts, bank] = await Promise.all([
      ClientReceipt.find({ piId: pi._id }).sort({ receiptDate: 1 }).lean(),
      getPrintBankDetails(pi.companyId),
    ]);
    return NextResponse.json({ success: true, data: { ...pi, receipts, bank } });
  } catch (error: any) {
    return errorResponse(error, "Failed to load PI");
  }
}

/**
 * Actions on a PI:
 *  - MARK_SENT: shared with the client
 *  - EDIT: change description / period / amount / notes while nothing has been received
 *  - CANCEL: void a PI that has no payments (reason required); the number is not reused
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await params;
    if (!isObjectId(id)) return badRequest("Invalid PI id");

    const pi: any = await ServicePI.findById(id);
    if (!pi) return NextResponse.json({ success: false, error: "PI not found" }, { status: 404 });
    const body = await req.json();
    const changedFields: { field: string; oldValue: any; newValue: any }[] = [];

    if (pi.status === "CANCELLED") throw new BillingError("This PI is cancelled");
    if (pi.taxInvoiceId) throw new BillingError("A tax invoice has been generated from this PI; it can no longer change.");

    switch (body.action) {
      case "MARK_SENT": {
        if (pi.status !== "GENERATED") throw new BillingError("Only a newly generated PI can be marked as sent");
        pi.status = "SENT";
        pi.sentAt = new Date();
        changedFields.push({ field: "status", oldValue: "GENERATED", newValue: "SENT" });
        break;
      }
      case "EDIT": {
        if (pi.amountReceivedPaise > 0) throw new BillingError("Payment has been received against this PI; it can no longer be edited.");
        if (body.description !== undefined) {
          const description = String(body.description || "").trim();
          if (!description) throw new BillingError("Enter the service description");
          changedFields.push({ field: "description", oldValue: pi.description, newValue: description });
          pi.description = description;
        }
        if (body.billingPeriodFrom !== undefined || body.billingPeriodTo !== undefined) {
          const period = requirePeriod(body.billingPeriodFrom ?? pi.billingPeriodFrom, body.billingPeriodTo ?? pi.billingPeriodTo);
          pi.billingPeriodFrom = period.billingPeriodFrom;
          pi.billingPeriodTo = period.billingPeriodTo;
          changedFields.push({ field: "billingPeriod", oldValue: null, newValue: period });
        }
        if (body.amount !== undefined) {
          // Keep the PI's own tax mode and rates; only the base amount changes
          const tax = computeTax(rupeesToPaiseStrict(body.amount, "Amount"), pi.taxMode, {
            cgstRate: pi.cgstRate,
            sgstRate: pi.sgstRate,
            igstRate: pi.igstRate,
          });
          changedFields.push({ field: "totalPaise", oldValue: pi.totalPaise, newValue: tax.totalPaise });
          Object.assign(pi, tax);
        }
        if (body.notes !== undefined) pi.notes = String(body.notes || "").trim();
        if (body.sacCode !== undefined) {
          const sac = String(body.sacCode || "").trim();
          if (sac && !/^d{4,8}$/.test(sac)) throw new BillingError("SAC code should be 4–8 digits");
          pi.sacCode = sac;
        }
        break;
      }
      case "CANCEL": {
        const reason = String(body.reason || "").trim();
        if (!reason) throw new BillingError("Give a reason for cancelling");
        const hasReceipts = await ClientReceipt.exists({ piId: pi._id, status: "ACTIVE" });
        if (hasReceipts || pi.amountReceivedPaise > 0) throw new BillingError("Void the receipts against this PI before cancelling it.");
        changedFields.push({ field: "status", oldValue: pi.status, newValue: "CANCELLED" });
        pi.status = "CANCELLED";
        pi.cancelledAt = new Date();
        pi.cancelledBy = auth.user._id;
        pi.cancelReason = reason;
        break;
      }
      default:
        return badRequest("Unknown action");
    }

    await pi.save();
    if (changedFields.length > 0) {
      await logAuditEntry({ collectionName: "servicepis", docId: pi._id, action: body.action, changedFields, userId: auth.user._id });
    }
    return NextResponse.json({ success: true, data: pi });
  } catch (error: any) {
    return errorResponse(error, "Failed to update PI");
  }
}
