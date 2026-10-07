/**
 * Shared billing master-data rules (companies, bank accounts, clients).
 * Pure functions only, so they work in API routes and in the browser.
 */

export const BILLING_ROLES = new Set(["superadmin", "admin", "director", "cfo", "financemanager"]);

/** Who may view and edit billing setup (companies' tax settings, bank accounts, billing clients). */
export function canManageBilling(role: unknown): boolean {
  return BILLING_ROLES.has(String(role || "").toLowerCase().replace(/[\s_-]+/g, ""));
}

export const GST_TYPES = ["GST", "NON_GST"] as const;
export type GstType = (typeof GST_TYPES)[number];

export const BUSINESS_TYPES = ["DIGITAL_MARKETING", "TRAINING", "BOOKS_MATERIAL"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  DIGITAL_MARKETING: "Digital Marketing",
  TRAINING: "Training",
  BOOKS_MATERIAL: "Books / Material",
};

export const BILLING_CYCLES = ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY", "CUSTOM"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];
export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-yearly",
  YEARLY: "Yearly",
  CUSTOM: "Custom",
};

export const BANK_ACCOUNT_TYPES = ["CURRENT", "SAVINGS", "OD_CC", "OTHER"] as const;
export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];
export const BANK_ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  CURRENT: "Current",
  SAVINGS: "Savings",
  OD_CC: "OD / Cash Credit",
  OTHER: "Other",
};

/** GST state codes (first two digits of a GSTIN). Used later to choose CGST+SGST vs IGST. */
export const INDIAN_STATES: { code: string; name: string }[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
];

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Trims/uppercases a GSTIN; placeholders like "Not Provided" become "". */
export function normalizeGstin(value: unknown): string {
  const v = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!v || v === "NOTPROVIDED" || v === "NA" || v === "N/A" || v === "NIL") return "";
  return v;
}

export function isValidGstin(value: unknown): boolean {
  const v = normalizeGstin(value);
  return GSTIN_RE.test(v) && INDIAN_STATES.some((s) => s.code === v.slice(0, 2));
}

export function stateFromGstin(value: unknown): { code: string; name: string } | null {
  const v = normalizeGstin(value);
  if (!isValidGstin(v)) return null;
  return INDIAN_STATES.find((s) => s.code === v.slice(0, 2)) || null;
}

export function stateByCode(code: unknown): { code: string; name: string } | null {
  return INDIAN_STATES.find((s) => s.code === String(code || "")) || null;
}

/**
 * A company's GST type. Older companies have no `gstType` yet: treat them as GST companies
 * when they hold a valid GSTIN, otherwise Non-GST.
 */
export function effectiveGstType(company: { gstType?: string | null; gst?: string | null }): GstType {
  if (company.gstType === "GST" || company.gstType === "NON_GST") return company.gstType;
  return isValidGstin(company.gst) ? "GST" : "NON_GST";
}

export const DEFAULT_TAX = { cgstRate: 9, sgstRate: 9, igstRate: 18 };

/** Only the last four digits of a bank account number are ever shown. */
export function maskAccountNumber(last4: string | null | undefined): string {
  return last4 ? `XXXX${last4}` : "";
}

export function clampBillingDay(value: unknown): number {
  const n = Math.round(Number(value));
  // 1–28 so the date exists in every month, February included
  if (!Number.isFinite(n)) return 1;
  return Math.min(28, Math.max(1, n));
}
