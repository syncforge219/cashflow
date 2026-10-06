/**
 * Phone Number Sanitization and Formatting Utilities
 * Standardizes Indian phone numbers across the CRM.
 * 
 * Rules:
 * - If 12 digits are typed or pasted (e.g. 911234567890 or +911234567890), ignores the first 2 digits (country code 91) -> "1234567890"
 * - If 11 digits starting with 0 (e.g. 09876543210), ignores the leading 0 -> "9876543210"
 * - If > 12 digits (e.g. pasted into an input that already had "+91 "), extracts the last 10 digits
 * - While typing, preserves partial digits (1 to 10 digits) without shifting
 */

/**
 * Normalizes input string to at most 10 clean phone digits.
 * Handles inputs with "+91", "91", leading "0", and ignores the first 2 digits
 * when 12 digits are supplied.
 */
export function sanitizePhoneDigits(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return "";
  const str = String(raw).trim();
  if (!str) return "";

  // Strip leading "+91 " or "+91" or "91 " if at the start
  let content = str;
  if (content.startsWith("+91 ")) {
    content = content.slice(4);
  } else if (content.startsWith("+91")) {
    content = content.slice(3);
  }

  // Extract all digit characters
  let digits = content.replace(/\D/g, "");

  // If 12 digits (e.g. 911234567890), ignore the first 2 digits
  if (digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    // 11 digits starting with 0 (e.g. 09876543210 -> 9876543210)
    digits = digits.slice(1);
  } else if (digits.length > 12) {
    // e.g. 91911234567890 (pasted 12 digits into a field that already had prefix)
    digits = digits.slice(-10);
  }

  // Take up to 10 digits
  return digits.slice(0, 10);
}

/**
 * Cleans phone text directly from clipboard paste events.
 * Ignores the first 2 digits if a 12-digit number was pasted.
 */
export function cleanPastedPhone(pasted: string | null | undefined): string {
  if (!pasted) return "";
  let digits = String(pasted).replace(/\D/g, "");

  // If 12 digits (e.g. 911234567890), ignore the first 2 digits
  if (digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  } else if (digits.length > 10) {
    // If more than 10 digits (e.g. +91 911234567890), take the last 10 digits
    digits = digits.slice(-10);
  }

  return digits.slice(0, 10);
}

/**
 * Formats a phone string for UI input fields displaying "+91 ".
 * Returns "+91 <digits>" or "+91 " if empty.
 */
export function formatPhoneWithPrefix(raw: string | number | null | undefined): string {
  const digits = sanitizePhoneDigits(raw);
  return digits ? `+91 ${digits}` : "+91 ";
}

/**
 * Formats a phone string for database submission.
 * Returns "+91 <digits>" if digits exist, or "" if blank.
 */
export function formatPhoneForSubmission(raw: string | number | null | undefined): string {
  const digits = sanitizePhoneDigits(raw);
  return digits ? `+91 ${digits}` : "";
}
