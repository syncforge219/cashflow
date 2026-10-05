import { getAuthenticatedUser } from "@/lib/auth";

export async function getUserFromCookies() {
  return await getAuthenticatedUser();
}

// Roles allowed to delete fee receipts (same as student-record deletion, plus finance roles).
const FINANCIAL_DELETE_ROLES = new Set([
  "admin", "superadmin", "director", "cfo", "financemanager",
  "brandmanager", "manager", "centrehead", "centerhead",
]);

export function canDeleteFinancialRecords(role: string | undefined | null): boolean {
  return FINANCIAL_DELETE_ROLES.has((role || "").toLowerCase().replace(/[\s_-]+/g, ""));
}


/**
 * Escapes user input so it can be embedded in a RegExp / Mongo $regex literally.
 * Without this, searches like "(" or "C++" throw and the endpoint returns 500.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
