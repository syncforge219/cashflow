import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ClientReceipt from "@/models/ClientReceipt";
import ServicePI from "@/models/ServicePI";
import ServiceInvoice from "@/models/ServiceInvoice";
import BankAccount from "@/models/BankAccount";
import { requireBillingUser, badRequest, isObjectId, errorResponse } from "@/lib/billingServer";
import {
  BillingError,
  nextReceiptNumber,
  recomputeInvoicePayments,
  recomputePiPayments,
  requireDate,
  rupeesToPaiseStrict,
} from "@/lib/billingDocs";
import { BUSINESS_TYPES } from "@/lib/billing";
import { withOptionalTransaction } from "@/lib/transactionHelper";
import { logAuditEntry } from "@/lib/auditLogger";
import { escapeRegex } from "@/lib/helper";
import { dateKeyToDate, istDayRange, toDateKey, todayKey } from "@/lib/dates";
import { formatINR } from "@/lib/money";

const PAYMENT_MODES = ["NEFT", "RTGS", "IMPS", "UPI", "CHEQUE", "CASH", "OTHER"];

export async function GET(req: Request) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const query: any = {};
    for (const key of ["clientId", "companyId", "bankAccountId", "piId", "invoiceId"] as const) {
      const v = searchParams.get(key);
      if (v) {
        if (!isObjectId(v)) return badRequest(`Invalid ${key}`);
        query[key] = v;
      }
    }
    const status = searchParams.get("status");
    if (status === "ACTIVE" || status === "VOIDED") query.status = status;
    const from = toDateKey(searchParams.get("from"));
    const to = toDateKey(searchParams.get("to"));
    if (from || to) query.receiptDate = { $gte: istDayRange(from || "2000-01-01").start, $lte: istDayRange(to || "2100-01-01").end };
    const q = (searchParams.get("q") || "").trim();
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      query.$or = [{ receiptNumber: rx }, { clientName: rx }, { linkedDocNumber: rx }, { transactionRef: rx }];
    }

    const receipts = await ClientReceipt.find(query).sort({ receiptDate: -1, createdAt: -1 }).limit(1000).lean();
    return NextResponse.json({ success: true, data: receipts });
  } catch (error: any) {
    return errorResponse(error, "Failed to load receipts");
  }
}

/**
 * Records money received against a PI (GST company) or a Non-GST invoice.
 * The bank account must belong to the document's company; the amount cannot exceed what is still due.
 */
export async function POST(req: Request) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;
    const body = await req.json();

    const receipt: any = await withOptionalTransaction(async (session) => {
      const opts = session ? { session } : undefined;
      const linkedDocType = body.linkedDocType;
      if (linkedDocType !== "PI" && linkedDocType !== "INVOICE") throw new BillingError("Choose the PI or invoice being paid");
      if (!isObjectId(body.docId)) throw new BillingError("Choose the PI or invoice being paid");

      const doc: any =
        linkedDocType === "PI"
          ? await ServicePI.findById(body.docId).session(session || null).lean()
          : await ServiceInvoice.findById(body.docId).session(session || null).lean();
      if (!doc) throw new BillingError(`${linkedDocType === "PI" ? "PI" : "Invoice"} not found`);
      if (linkedDocType === "PI") {
        if (doc.status === "CANCELLED") throw new BillingError(`PI ${doc.piNumber} is cancelled`);
        if (doc.taxInvoiceId) throw new BillingError(`PI ${doc.piNumber} is already invoiced`);
      } else if (doc.invoiceType !== "NON_GST_INVOICE") {
        throw new BillingError("Record payments for GST billing against the PI, not the tax invoice");
      }
      const docNumber = linkedDocType === "PI" ? doc.piNumber : doc.invoiceNumber;

      const amountPaise = rupeesToPaiseStrict(body.amount, "Amount received");
      const duePaise = doc.totalPaise - (doc.amountReceivedPaise || 0);
      if (duePaise <= 0) throw new BillingError(`${docNumber} is already fully paid`);
      if (amountPaise > duePaise) {
        throw new BillingError(`Amount is more than the ${formatINR(duePaise)} still due on ${docNumber}`);
      }

      const receiptDate = requireDate(body.receiptDate, "Receipt date");
      if (receiptDate > dateKeyToDate(todayKey())) throw new BillingError("Receipt date cannot be in the future");

      if (!isObjectId(body.bankAccountId)) throw new BillingError("Choose the bank account the money came into");
      const bank: any = await BankAccount.findById(body.bankAccountId).session(session || null).lean();
      if (!bank || bank.status !== "ACTIVE") throw new BillingError("That bank account is not active");
      if (String(bank.companyId) !== String(doc.companyId)) {
        throw new BillingError(`${bank.label} belongs to a different company than ${docNumber}`);
      }

      const paymentMode = body.paymentMode || "NEFT";
      if (!PAYMENT_MODES.includes(paymentMode)) throw new BillingError("Unknown payment mode");
      const transactionRef = String(body.transactionRef || "").trim();
      if (paymentMode !== "CASH" && !transactionRef) throw new BillingError("Enter the transaction / cheque reference");
      const businessType = body.businessType || doc.businessType || "DIGITAL_MARKETING";
      if (!(BUSINESS_TYPES as readonly string[]).includes(businessType)) throw new BillingError("Unknown business type");

      const { number, financialYear } = await nextReceiptNumber(receiptDate, session);
      const [created] = await ClientReceipt.create(
        [
          {
            receiptNumber: number,
            financialYear,
            receiptDate,
            clientId: doc.clientId,
            clientName: doc.client?.name || "",
            clientGstin: doc.client?.gstin || "",
            companyId: doc.companyId,
            companyName: doc.company?.name || "",
            bankAccountId: bank._id,
            bankLabel: bank.label,
            linkedDocType,
            piId: linkedDocType === "PI" ? doc._id : null,
            invoiceId: linkedDocType === "INVOICE" ? doc._id : null,
            linkedDocNumber: docNumber,
            businessType,
            gstApplicable: doc.company?.gstType === "GST",
            amountPaise,
            paymentMode,
            transactionRef,
            notes: String(body.notes || "").trim(),
          },
        ],
        opts
      );

      if (linkedDocType === "PI") await recomputePiPayments(doc._id, session);
      else await recomputeInvoicePayments(doc._id, session);
      return created;
    });

    await logAuditEntry({
      collectionName: "clientreceipts",
      docId: receipt._id,
      action: "CREATE",
      changedFields: [
        { field: "receiptNumber", oldValue: null, newValue: receipt.receiptNumber },
        { field: "linkedDocNumber", oldValue: null, newValue: receipt.linkedDocNumber },
        { field: "amountPaise", oldValue: null, newValue: receipt.amountPaise },
        { field: "bankLabel", oldValue: null, newValue: receipt.bankLabel },
      ],
      userId: auth.user._id,
    });

    return NextResponse.json({ success: true, message: `Receipt ${receipt.receiptNumber} recorded`, data: receipt }, { status: 201 });
  } catch (error: any) {
    return errorResponse(error, "Failed to record receipt");
  }
}
