import { NextResponse } from "next/server";
import mongoose from "mongoose";
import type { AuthenticatedUser } from "@/lib/auth";
import { getUserFromCookies } from "@/lib/helper";
import { canManageBilling } from "@/lib/billing";
import { billingErrorStatus } from "@/lib/billingDocs";

/**
 * Billing setup is restricted to Admin / Director / CFO / Finance Manager.
 * Returns the user, or a 401/403 response to send back as-is.
 */
export async function requireBillingUser(): Promise<
  { user: AuthenticatedUser; errorResponse?: undefined } | { user?: undefined; errorResponse: NextResponse }
> {
  const user = await getUserFromCookies();
  if (!user) {
    return { errorResponse: NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 }) };
  }
  if (!canManageBilling(user.role)) {
    return {
      errorResponse: NextResponse.json(
        { success: false, error: "Only Admin, Director, CFO or Finance Manager can manage billing setup." },
        { status: 403 }
      ),
    };
  }
  return { user };
}

export function badRequest(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

export function isObjectId(value: unknown): value is string {
  return typeof value === "string" && mongoose.Types.ObjectId.isValid(value);
}

/** Rule violations, duplicates and Mongoose validation errors are the caller's to fix; everything else is a 500. */
export function errorResponse(error: any, fallback: string) {
  const known = billingErrorStatus(error);
  if (known) {
    return NextResponse.json({ success: false, error: known.message || fallback }, { status: known.status });
  }
  console.error(`[Billing API] ${fallback}:`, error);
  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}
