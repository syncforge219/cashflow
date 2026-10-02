/**
 * Financial Year Helper for Indian Fiscal Cycle: 1st April to 31st March
 * Timezone: Asia/Kolkata (IST)
 */

export interface FinancialYearRange {
  label: string;          // e.g. "2026-27"
  displayLabel: string;   // e.g. "FY 2026-27 (1 Apr 2026 - 31 Mar 2027)"
  startDate: Date;        // 1st April 00:00:00.000 IST
  endDate: Date;          // 31st March 23:59:59.999 IST
  startYear: number;      // 2026
  endYear: number;        // 2027
}

/**
 * Returns financial year label in "YYYY-YY" format (e.g., "2026-27") based on Indian fiscal cycle (1st April - 31st March)
 */
export function getFinancialYear(dateInput: Date = new Date()): string {
  try {
    const istDateStr = dateInput.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const [yearStr, monthStr] = istDateStr.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    if (month >= 4) {
      const nextYear = String(year + 1).slice(-2);
      return `${year}-${nextYear}`;
    } else {
      const prevYear = year - 1;
      const currYear = String(year).slice(-2);
      return `${prevYear}-${currYear}`;
    }
  } catch {
    const year = dateInput.getFullYear();
    const month = dateInput.getMonth() + 1;
    if (month >= 4) {
      const nextYear = String(year + 1).slice(-2);
      return `${year}-${nextYear}`;
    } else {
      const prevYear = year - 1;
      const currYear = String(year).slice(-2);
      return `${prevYear}-${currYear}`;
    }
  }
}

/**
 * Returns exact start and end Date objects for the financial year (1st April 00:00:00 IST to 31st March 23:59:59.999 IST)
 */
export function getFinancialYearRange(dateOrFy?: Date | string): FinancialYearRange {
  let startYear: number;
  let endYear: number;

  if (typeof dateOrFy === "string" && /^\d{4}-\d{2,4}$/.test(dateOrFy.trim())) {
    const parts = dateOrFy.trim().split("-");
    startYear = parseInt(parts[0], 10);
    endYear = parts[1].length === 2 ? Math.floor(startYear / 100) * 100 + parseInt(parts[1], 10) : parseInt(parts[1], 10);
  } else {
    const targetDate = dateOrFy instanceof Date ? dateOrFy : new Date();
    let year: number;
    let month: number;

    try {
      const istDateStr = targetDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const [yearStr, monthStr] = istDateStr.split("-");
      year = parseInt(yearStr, 10);
      month = parseInt(monthStr, 10);
    } catch {
      year = targetDate.getFullYear();
      month = targetDate.getMonth() + 1;
    }

    if (month >= 4) {
      startYear = year;
      endYear = year + 1;
    } else {
      startYear = year - 1;
      endYear = year;
    }
  }

  // 1st April 00:00:00 IST = (startYear)-04-01T00:00:00+05:30
  // 31st March 23:59:59.999 IST = (endYear)-03-31T23:59:59.999+05:30
  const startDate = new Date(`${startYear}-04-01T00:00:00+05:30`);
  const endDate = new Date(`${endYear}-03-31T23:59:59.999+05:30`);
  const label = `${startYear}-${String(endYear).slice(-2)}`;
  const displayLabel = `FY ${label} (1 Apr ${startYear} - 31 Mar ${endYear})`;

  return {
    label,
    displayLabel,
    startDate,
    endDate,
    startYear,
    endYear,
  };
}

/**
 * Returns true if a given date falls within the specified financial year (defaults to current FY)
 */
export function isDateInFinancialYear(date: Date | string, fyRange?: FinancialYearRange): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  const range = fyRange || getFinancialYearRange();
  return d >= range.startDate && d <= range.endDate;
}
