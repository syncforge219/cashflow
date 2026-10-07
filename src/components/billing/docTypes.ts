import { formatINR } from "@/lib/money";
import { daysBetween, todayKey, toDateKey } from "@/lib/dates";
import { PI_AGE_WARNING_DAYS } from "@/lib/billingTax";

export interface PartySnapshot {
  name: string;
  legalName?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
  email?: string;
  phone?: string;
  gstType?: "GST" | "NON_GST";
}

interface Amounts {
  taxMode: "CGST_SGST" | "IGST" | "NONE";
  basePaise: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  totalPaise: number;
  amountReceivedPaise: number;
}

export interface ServicePIDoc extends Amounts {
  _id: string;
  piNumber: string;
  piDate: string;
  companyId: string;
  company: PartySnapshot;
  clientId: string;
  client: PartySnapshot;
  businessType: string;
  description: string;
  sacCode?: string;
  billingPeriodFrom: string;
  billingPeriodTo: string;
  notes?: string;
  status: "GENERATED" | "SENT" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  sentAt?: string | null;
  cancelReason?: string;
  taxInvoiceId?: string | null;
}

export interface ServiceInvoiceDoc extends Amounts {
  _id: string;
  invoiceType: "TAX_INVOICE" | "NON_GST_INVOICE";
  invoiceNumber: string;
  invoiceDate: string;
  companyId: string;
  company: PartySnapshot;
  clientId: string;
  client: PartySnapshot;
  piId?: string | null;
  piNumber?: string;
  saleType: "REGISTERED" | "UNREGISTERED" | "NON_GST";
  businessType: string;
  description: string;
  sacCode?: string;
  billingPeriodFrom: string;
  billingPeriodTo: string;
  notes?: string;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
}

export interface ClientReceiptDoc {
  _id: string;
  receiptNumber: string;
  receiptDate: string;
  clientId: string;
  clientName: string;
  companyId: string;
  companyName: string;
  bankAccountId: string;
  bankLabel: string;
  linkedDocType: "PI" | "INVOICE";
  piId?: string | null;
  invoiceId?: string | null;
  linkedDocNumber: string;
  businessType: string;
  gstApplicable: boolean;
  amountPaise: number;
  paymentMode: string;
  transactionRef: string;
  notes?: string;
  status: "ACTIVE" | "VOIDED";
  voidReason?: string;
}

/** Money is stored in paise everywhere; always show 2 decimals on billing screens. */
export const inr = (paise: number | null | undefined) => formatINR(paise || 0, { showPaise: true });

export const duePaise = (doc: { totalPaise: number; amountReceivedPaise?: number }) =>
  Math.max(0, doc.totalPaise - (doc.amountReceivedPaise || 0));

export const PI_STATUS_LABELS: Record<ServicePIDoc["status"], string> = {
  GENERATED: "Generated",
  SENT: "Sent · payment pending",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export const SALE_TYPE_LABELS: Record<ServiceInvoiceDoc["saleType"], string> = {
  REGISTERED: "Registered (B2B)",
  UNREGISTERED: "Unregistered (B2C)",
  NON_GST: "Non-GST",
};

export const PAYMENT_MODES = ["NEFT", "RTGS", "IMPS", "UPI", "CHEQUE", "CASH", "OTHER"] as const;

/** Unpaid for PI_AGE_WARNING_DAYS+ days: GST expects the tax invoice within 30 days of the service. */
export function piAgeWarning(pi: ServicePIDoc): string | null {
  if (!["GENERATED", "SENT", "PARTIALLY_PAID"].includes(pi.status)) return null;
  const age = daysBetween(toDateKey(pi.piDate), todayKey());
  return age >= PI_AGE_WARNING_DAYS ? `Unpaid ${age} days` : null;
}

export const taxModeLabel = (d: Amounts) =>
  d.taxMode === "IGST" ? `IGST ${d.igstRate}%` : d.taxMode === "CGST_SGST" ? `CGST ${d.cgstRate}% + SGST ${d.sgstRate}%` : "No GST";
