/**
 * Shared Money Utility
 * 
 * In this system, all monetary amounts are standardized to integer paise (1 Rupee = 100 Paise).
 * All monetary arithmetic (additions, subtractions, discounts, GST calculations) MUST happen in integer paise
 * to eliminate IEEE 754 floating-point rounding errors.
 */

/**
 * Converts a rupee value (number or string) to integer paise.
 * Safely handles floating-point imprecision using Math.round.
 * Examples:
 *   toPaise(100) -> 10000
 *   toPaise(99.99) -> 9999
 *   toPaise("1500.50") -> 150050
 *   toPaise(null) -> 0
 */
export function toPaise(rupees: number | string | null | undefined): number {
  if (rupees === null || rupees === undefined || rupees === "") {
    return 0;
  }
  const num = typeof rupees === "number" ? rupees : parseFloat(String(rupees).replace(/[^0-9.-]/g, ""));
  if (isNaN(num) || !isFinite(num)) {
    return 0;
  }
  return Math.round(num * 100);
}

/**
 * Converts integer paise back to rupees (floating point).
 * Examples:
 *   fromPaise(10000) -> 100
 *   fromPaise(9999) -> 99.99
 *   fromPaise(0) -> 0
 */
export function fromPaise(paise: number | null | undefined): number {
  if (paise === null || paise === undefined || isNaN(paise)) {
    return 0;
  }
  return Math.round(paise) / 100;
}

/**
 * Checks if a rupee value has more than 2 decimal places (fractional paise).
 * Useful for auditing legacy drift and detecting floating point contamination.
 * Examples:
 *   hasFractionalPaise(100.5) -> false
 *   hasFractionalPaise(100.55) -> false
 *   hasFractionalPaise(100.555) -> true
 */
export function hasFractionalPaise(rupees: number | string | null | undefined): boolean {
  if (rupees === null || rupees === undefined || rupees === "") return false;
  const num = typeof rupees === "number" ? rupees : parseFloat(String(rupees).replace(/[^0-9.-]/g, ""));
  if (isNaN(num) || !isFinite(num)) return false;

  // Compare num * 100 with its rounded integer counterpart
  const paise = num * 100;
  const diff = Math.abs(paise - Math.round(paise));
  // Allow a tiny epsilon for IEEE 754 precision issues (e.g. 19.99 * 100 = 1998.9999999999998)
  return diff > 1e-4;
}

/**
 * Formats integer paise as standard Indian Rupee currency string.
 * Uses Indian numbering grouping (lakhs, crores).
 * Examples:
 *   formatINR(10000000) -> "₹1,00,000"
 *   formatINR(10000050, { showPaise: true }) -> "₹1,00,000.50"
 */
export function formatINR(
  paise: number | null | undefined,
  options?: { showPaise?: boolean }
): string {
  const p = Math.round(paise || 0);
  const rupees = p / 100;

  const showPaise = options?.showPaise ?? (p % 100 !== 0);

  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: showPaise ? 2 : 0,
    maximumFractionDigits: 2,
  });

  return formatter.format(rupees);
}

/**
 * Line-Item GST Calculation
 * 
 * Rounding Rule:
 * Indian GST calculations on Quotations / Proforma Invoices / Purchase Orders must be calculated
 * and rounded per line item.
 * 
 * Taxable Amount (Paise) = Math.round(quantity * ratePaise)
 * GST Amount (Paise) = Math.round((taxableAmountPaise * gstRatePercent) / 100)
 * Line Total (Paise) = taxableAmountPaise + gstAmountPaise
 */
export interface LineItemGstResult {
  taxableAmountPaise: number;
  gstAmountPaise: number;
  totalAmountPaise: number;
  taxableAmountRupees: number;
  gstAmountRupees: number;
  totalAmountRupees: number;
}

export function calculateLineItemGst(
  quantity: number,
  ratePaise: number,
  gstRatePercent: number
): LineItemGstResult {
  const qty = Number(quantity) || 0;
  const rate = Math.round(Number(ratePaise) || 0);
  const gstRate = Number(gstRatePercent) || 0;

  const taxableAmountPaise = Math.round(qty * rate);
  const gstAmountPaise = Math.round((taxableAmountPaise * gstRate) / 100);
  const totalAmountPaise = taxableAmountPaise + gstAmountPaise;

  return {
    taxableAmountPaise,
    gstAmountPaise,
    totalAmountPaise,
    taxableAmountRupees: fromPaise(taxableAmountPaise),
    gstAmountRupees: fromPaise(gstAmountPaise),
    totalAmountRupees: fromPaise(totalAmountPaise),
  };
}

/**
 * Calculates document totals across multiple line items with per-line GST rounding.
 */
export interface DocumentTotalsInput {
  items: Array<{
    quantity: number;
    ratePaise: number;
    gstRate?: number;
  }>;
  discountPaise?: number;
  transportChargesPaise?: number;
  additionalChargesPaise?: number;
}

export interface DocumentTotalsResult {
  subtotalPaise: number;
  discountPaise: number;
  gstAmountPaise: number;
  transportChargesPaise: number;
  additionalChargesPaise: number;
  grandTotalPaise: number;
  // Rupee equivalents
  subtotal: number;
  discount: number;
  gstAmount: number;
  transportCharges: number;
  additionalCharges: number;
  grandTotal: number;
  itemBreakdowns: LineItemGstResult[];
}

export function calculateDocumentTotals(input: DocumentTotalsInput): DocumentTotalsResult {
  const itemBreakdowns: LineItemGstResult[] = [];
  let subtotalPaise = 0;
  let gstAmountPaise = 0;

  for (const item of input.items || []) {
    const breakdown = calculateLineItemGst(
      item.quantity,
      item.ratePaise,
      item.gstRate ?? 18
    );
    itemBreakdowns.push(breakdown);
    subtotalPaise += breakdown.taxableAmountPaise;
    gstAmountPaise += breakdown.gstAmountPaise;
  }

  const discountPaise = Math.round(input.discountPaise || 0);
  const transportChargesPaise = Math.round(input.transportChargesPaise || 0);
  const additionalChargesPaise = Math.round(input.additionalChargesPaise || 0);

  // Grand Total = Subtotal - Discount + GST + Transport + Additional
  const grandTotalPaise = Math.max(
    0,
    subtotalPaise - discountPaise + gstAmountPaise + transportChargesPaise + additionalChargesPaise
  );

  return {
    subtotalPaise,
    discountPaise,
    gstAmountPaise,
    transportChargesPaise,
    additionalChargesPaise,
    grandTotalPaise,
    subtotal: fromPaise(subtotalPaise),
    discount: fromPaise(discountPaise),
    gstAmount: fromPaise(gstAmountPaise),
    transportCharges: fromPaise(transportChargesPaise),
    additionalCharges: fromPaise(additionalChargesPaise),
    grandTotal: fromPaise(grandTotalPaise),
    itemBreakdowns,
  };
}
