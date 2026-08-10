/**
 * Batch Lifecycle & Date Helper Functions
 */

/**
 * Returns a standardized YYYY-MM-DD date string in local/UTC format
 */
export function getLocalDateStr(date: Date | string | undefined | null): string {
  if (!date) return "";
  if (typeof date === "string") {
    if (date.includes("T")) {
      return date.split("T")[0];
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
  }
  const dt = new Date(date);
  if (isNaN(dt.getTime())) return "";

  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type BatchStatus = "Upcoming" | "Active" | "Completed" | "Cancelled";

/**
 * Computes the lifecycle status of a batch based on startDate, endDate and current date.
 * - If status is Cancelled, it remains Cancelled.
 * - If endDate is in the past (endDate crossed), status is Completed.
 * - If startDate is in the future, status is Upcoming.
 * - If startDate has arrived/passed and endDate is either in the future or not set, status is Active.
 */
export function computeBatchStatus(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
  currentStatus?: string,
  referenceDate: Date = new Date()
): BatchStatus {
  if (currentStatus === "Cancelled") {
    return "Cancelled";
  }

  if (!startDate) {
    return "Upcoming";
  }

  const todayStr = getLocalDateStr(referenceDate);
  const startStr = getLocalDateStr(startDate);
  const endStr = endDate ? getLocalDateStr(endDate) : "";

  // If batch has an end date and today's date has crossed that end date
  if (endStr && todayStr > endStr) {
    return "Completed";
  }

  // If start date is in the future
  if (startStr && todayStr < startStr) {
    return "Upcoming";
  }

  // Otherwise, start date has arrived and end date is either not set or in the future/today
  return "Active";
}

/**
 * Determines whether a batch is active and running on a specific target calendar date and day of week.
 *
 * @param batch The batch object containing startDate, endDate, days, status
 * @param targetDateStr YYYY-MM-DD formatted date string of the target day
 * @param targetDayOfWeek Optional 3-letter day (e.g. "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
 */
export function isBatchActiveOnDate(
  batch: any,
  targetDateStr: string,
  targetDayOfWeek?: string
): boolean {
  if (!batch || !targetDateStr) return false;

  // Cancelled batches are never active
  if (batch.status === "Cancelled") return false;

  const startStr = getLocalDateStr(batch.startDate);
  const endStr = batch.endDate ? getLocalDateStr(batch.endDate) : "";

  // Cannot be active before start date
  if (startStr && targetDateStr < startStr) {
    return false;
  }

  // Cannot be active after end date (end date is crossed for this date)
  if (endStr && targetDateStr > endStr) {
    return false;
  }

  // If day of week is provided and batch specifies schedule days, verify match
  if (targetDayOfWeek && Array.isArray(batch.days) && batch.days.length > 0) {
    const formattedTargetDay =
      targetDayOfWeek.charAt(0).toUpperCase() + targetDayOfWeek.slice(1, 3).toLowerCase();
    const dayMatches = batch.days.some((d: string) => {
      const formattedD = d.charAt(0).toUpperCase() + d.slice(1, 3).toLowerCase();
      return formattedD === formattedTargetDay;
    });
    if (!dayMatches) {
      return false;
    }
  }

  return true;
}
