/**
 * GST maths for agency billing. Pure functions in integer paise (see lib/money.ts), so the same
 * numbers are produced on the server and in the browser preview.
 */

export type TaxMode = "CGST_SGST" | "IGST" | "NONE";
export type SaleType = "REGISTERED" | "UNREGISTERED" | "NON_GST";

export interface TaxRates {
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
}

export interface TaxBreakup {
  taxMode: TaxMode;
  basePaise: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  taxPaise: number;
  totalPaise: number;
}

/**
 * Same state (or client state unknown) -> CGST + SGST; different state -> IGST.
 * Non-GST companies charge no tax at all.
 */
export function pickTaxMode(companyGstType: string, companyStateCode?: string | null, clientStateCode?: string | null): TaxMode {
  if (companyGstType !== "GST") return "NONE";
  if (companyStateCode && clientStateCode && companyStateCode !== clientStateCode) return "IGST";
  return "CGST_SGST";
}

const pct = (basePaise: number, rate: number) => Math.round((basePaise * rate) / 100);

export function computeTax(basePaise: number, taxMode: TaxMode, rates: TaxRates): TaxBreakup {
  const base = Math.max(0, Math.round(basePaise));
  const out: TaxBreakup = {
    taxMode,
    basePaise: base,
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 0,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
    taxPaise: 0,
    totalPaise: base,
  };
  if (taxMode === "CGST_SGST") {
    out.cgstRate = rates.cgstRate;
    out.sgstRate = rates.sgstRate;
    out.cgstPaise = pct(base, rates.cgstRate);
    out.sgstPaise = pct(base, rates.sgstRate);
  } else if (taxMode === "IGST") {
    out.igstRate = rates.igstRate;
    out.igstPaise = pct(base, rates.igstRate);
  }
  out.taxPaise = out.cgstPaise + out.sgstPaise + out.igstPaise;
  out.totalPaise = base + out.taxPaise;
  return out;
}

/** Registered (client has GSTIN) / Unregistered sale for GST companies; Non-GST sale otherwise. */
export function saleTypeFor(companyGstType: string, clientGstin?: string | null): SaleType {
  if (companyGstType !== "GST") return "NON_GST";
  return clientGstin ? "REGISTERED" : "UNREGISTERED";
}

/** "2026-27" -> "2627", used inside document numbers. */
export function shortFy(fyLabel: string): string {
  const [a, b] = fyLabel.split("-");
  return `${(a || "").slice(-2)}${(b || "").slice(-2)}`;
}

/** formatDocNumber(prefix, "2026-27", 7) -> "<prefix>/2627/0007" (max 16 chars with a 6-char prefix). */
export function formatDocNumber(prefix: string, fyLabel: string, seq: number): string {
  return `${prefix}/${shortFy(fyLabel)}/${String(seq).padStart(4, "0")}`;
}

/** PIs unpaid this long get flagged: GST expects the tax invoice within 30 days of the service. */
export const PI_AGE_WARNING_DAYS = 25;
