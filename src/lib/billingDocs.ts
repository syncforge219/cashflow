import mongoose, { type ClientSession } from "mongoose";
import Counter from "@/models/Counter";
import Company from "@/models/Company";
import QuotationCustomer from "@/models/QuotationCustomer";
import ServicePI from "@/models/ServicePI";
import ServiceInvoice from "@/models/ServiceInvoice";
import ClientReceipt from "@/models/ClientReceipt";
import { DEFAULT_TAX, effectiveGstType, normalizeGstin, stateByCode, stateFromGstin, type GstType } from "@/lib/billing";
import { formatDocNumber, pickTaxMode, type TaxMode, type TaxRates } from "@/lib/billingTax";
import { getFinancialYear } from "@/lib/financialYearHelper";
import { parseDateOnly } from "@/lib/dates";

/** A rule violation the user can fix; API routes turn it into a 400 with this message. */
export class BillingError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "BillingError";
    this.status = status;
  }
}

const withSession = <T extends { session: (s: ClientSession | null) => T }>(q: T, session?: ClientSession | null) =>
  session ? q.session(session) : q;

export interface BillingParties {
  client: any;
  company: any;
  gstType: GstType;
  companySnapshot: Record<string, any>;
  clientSnapshot: Record<string, any>;
  taxMode: TaxMode;
  rates: TaxRates;
}

/**
 * Loads a client and one of our companies for a new document and enforces the master-data rules:
 * the client must be an active billing client, the company active, and the client mapped to it.
 */
export async function loadBillingParties(clientId: unknown, companyId: unknown, session?: ClientSession | null): Promise<BillingParties> {
  if (!mongoose.Types.ObjectId.isValid(String(clientId))) throw new BillingError("Choose a client");
  if (!mongoose.Types.ObjectId.isValid(String(companyId))) throw new BillingError("Choose the billing company");

  const client: any = await withSession(QuotationCustomer.findById(clientId), session).lean();
  if (!client || !client.isBillingClient) throw new BillingError("Client not found. Add it in Billing Setup → Clients first.");
  if ((client.clientStatus || "ACTIVE") !== "ACTIVE") throw new BillingError(`${client.name} is inactive. Re-activate it in Billing Setup to bill it.`);

  const company: any = await withSession(Company.findById(companyId), session).lean();
  if (!company) throw new BillingError("Billing company not found");
  if (company.status === "INACTIVE") throw new BillingError(`${company.name} is inactive`);

  const mapped = (client.billingCompanyIds || []).some((id: any) => String(id) === String(company._id));
  if (!mapped) throw new BillingError(`${client.name} is not mapped to ${company.name}. Add the mapping in Billing Setup → Clients.`);

  const gstType = effectiveGstType(company);
  const companyGstin = normalizeGstin(company.gst);
  const companyStateCode = company.stateCode || stateFromGstin(companyGstin)?.code || "";
  const clientGstin = normalizeGstin(client.gstin);
  const clientStateCode = client.stateCode || stateFromGstin(clientGstin)?.code || "";

  return {
    client,
    company,
    gstType,
    companySnapshot: {
      name: company.name || "",
      legalName: company.legalName || company.name || "",
      gstin: companyGstin,
      pan: company.pan && company.pan !== "Not Provided" ? company.pan : "",
      address: company.address || "",
      stateCode: companyStateCode,
      gstType,
    },
    clientSnapshot: {
      name: client.name || "",
      gstin: clientGstin,
      address: client.address || "",
      city: client.city || "",
      state: client.state || stateByCode(clientStateCode)?.name || "",
      stateCode: clientStateCode,
      pincode: client.pincode || "",
      email: client.email || "",
      phone: client.phone || "",
    },
    taxMode: pickTaxMode(gstType, companyStateCode, clientStateCode),
    rates: { ...DEFAULT_TAX, ...(company.taxDefaults || {}) },
  };
}

type SeriesKind = "PI" | "TAX_INVOICE" | "NON_GST_INVOICE";
const SERIES_FIELD: Record<SeriesKind, string> = {
  PI: "piPrefix",
  TAX_INVOICE: "taxInvoicePrefix",
  NON_GST_INVOICE: "nonGstInvoicePrefix",
};
const SERIES_LABEL: Record<SeriesKind, string> = {
  PI: "PI",
  TAX_INVOICE: "tax invoice",
  NON_GST_INVOICE: "invoice",
};

/** Atomic +1 on a named counter (created on first use). */
async function incrementCounter(name: string, session?: ClientSession | null): Promise<number> {
  const opts: any = { upsert: true, new: true };
  if (session) opts.session = session;
  try {
    const c: any = await Counter.findOneAndUpdate({ name }, { $inc: { seq: 1 } }, opts);
    return c.seq;
  } catch (err: any) {
    // Two first-ever requests can race on the upsert; the loser simply retries the increment
    if (err?.code === 11000) {
      const c: any = await Counter.findOneAndUpdate({ name }, { $inc: { seq: 1 } }, { ...opts, upsert: false });
      return c.seq;
    }
    throw err;
  }
}

/** Next number in a company's series for the financial year of `docDate`, e.g. PREFIX/2627/0001. */
export async function nextDocNumber(company: any, kind: SeriesKind, docDate: Date, session?: ClientSession | null) {
  const prefix = String(company?.invoiceSeries?.[SERIES_FIELD[kind]] || "").trim().toUpperCase();
  if (!prefix) {
    throw new BillingError(`Set the ${SERIES_LABEL[kind]} number prefix for ${company?.name} in Billing Setup → Companies.`);
  }
  const financialYear = getFinancialYear(docDate);
  const seq = await incrementCounter(`billing:${kind}:${company._id}:${financialYear}`, session);
  return { number: formatDocNumber(prefix, financialYear, seq), financialYear };
}

/** Receipts share one series across companies: RCPT/2627/0001. */
export async function nextReceiptNumber(receiptDate: Date, session?: ClientSession | null) {
  const financialYear = getFinancialYear(receiptDate);
  const seq = await incrementCounter(`billing:RECEIPT:${financialYear}`, session);
  return { number: formatDocNumber("RCPT", financialYear, seq), financialYear };
}

/** Recalculates a PI's received amount and status from its ACTIVE receipts. */
export async function recomputePiPayments(piId: any, session?: ClientSession | null) {
  const pi: any = await withSession(ServicePI.findById(piId), session);
  if (!pi) return null;
  const rows = await ClientReceipt.aggregate([
    { $match: { piId: pi._id, status: "ACTIVE" } },
    { $group: { _id: null, total: { $sum: "$amountPaise" } } },
  ]).session(session || null);
  const received = rows[0]?.total || 0;
  pi.amountReceivedPaise = received;
  if (pi.status !== "CANCELLED") {
    if (received >= pi.totalPaise && pi.totalPaise > 0) {
      pi.status = "PAID";
      pi.paidAt = pi.paidAt || new Date();
    } else {
      pi.paidAt = null;
      pi.status = received > 0 ? "PARTIALLY_PAID" : pi.sentAt ? "SENT" : "GENERATED";
    }
  }
  await pi.save(session ? { session } : undefined);
  return pi;
}

/** Same for a Non-GST invoice. */
export async function recomputeInvoicePayments(invoiceId: any, session?: ClientSession | null) {
  const inv: any = await withSession(ServiceInvoice.findById(invoiceId), session);
  if (!inv) return null;
  const rows = await ClientReceipt.aggregate([
    { $match: { invoiceId: inv._id, status: "ACTIVE" } },
    { $group: { _id: null, total: { $sum: "$amountPaise" } } },
  ]).session(session || null);
  const received = rows[0]?.total || 0;
  inv.amountReceivedPaise = received;
  inv.paymentStatus = received >= inv.totalPaise && inv.totalPaise > 0 ? "PAID" : received > 0 ? "PARTIALLY_PAID" : "UNPAID";
  await inv.save(session ? { session } : undefined);
  return inv;
}

/**
 * Bank details printed on PIs / invoices so the client knows where to pay: the company's default
 * active account (else its first active one), with the full account number decrypted.
 */
export async function getPrintBankDetails(companyId: any) {
  const { default: BankAccount } = await import("@/models/BankAccount");
  const { decryptField } = await import("@/lib/encryption");
  const acct: any = await BankAccount.findOne({ companyId, status: "ACTIVE" })
    .select("+accountNumber")
    .sort({ isDefault: -1, createdAt: 1 })
    .lean();
  if (!acct) return null;
  return {
    bankName: acct.bankName,
    accountHolderName: acct.accountHolderName || "",
    accountNumber: decryptField(acct.accountNumber) || "",
    ifsc: acct.ifsc || "",
    branch: acct.branch || "",
    upiId: acct.upiId || "",
  };
}

/** Parses a rupee amount from user input into paise; must be > 0 and have at most 2 decimals. */
export function rupeesToPaiseStrict(value: unknown, label: string): number {
  const str = String(value ?? "").replace(/[,₹\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(str)) throw new BillingError(`${label} must be a number with up to 2 decimals`);
  const paise = Math.round(parseFloat(str) * 100);
  if (paise <= 0) throw new BillingError(`${label} must be more than zero`);
  if (paise > 100_000_000_00) throw new BillingError(`${label} looks too large`);
  return paise;
}

export function requireDate(value: unknown, label: string): Date {
  const d = parseDateOnly(value as any);
  if (!d) throw new BillingError(`${label} is required`);
  return d;
}

export function requirePeriod(from: unknown, to: unknown) {
  const billingPeriodFrom = requireDate(from, "Billing period start");
  const billingPeriodTo = requireDate(to, "Billing period end");
  if (billingPeriodTo < billingPeriodFrom) throw new BillingError("Billing period end is before its start");
  return { billingPeriodFrom, billingPeriodTo };
}

/** Converts thrown errors into API responses (BillingError -> 4xx with its message). */
export function billingErrorStatus(error: any): { status: number; message: string } | null {
  if (error instanceof BillingError) return { status: error.status, message: error.message };
  if (error?.code === 11000) return { status: 409, message: "That number was just used by another entry. Please try again." };
  if (error?.name === "ValidationError" || error?.name === "CastError") return { status: 400, message: error.message };
  return null;
}
