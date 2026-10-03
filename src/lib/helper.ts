import { getAuthenticatedUser } from "@/lib/auth";

export async function getUserFromCookies() {
  return await getAuthenticatedUser();
}


/**
 * Escapes user input so it can be embedded in a RegExp / Mongo $regex literally.
 * Without this, searches like "(" or "C++" throw and the endpoint returns 500.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
