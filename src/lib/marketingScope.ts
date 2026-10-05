import mongoose from "mongoose";
import { NextResponse } from "next/server";
import User from "@/models/User";
import { getUserFromCookies } from "@/lib/helper";
import { isMarketingExecutive, isAdminRole, MARKETING_ROLE } from "@/lib/roles";
import { todayKey, isDateKey, istDayRange, monthBoundsKey } from "@/lib/dates";

export interface MarketingScope {
  actor: any;
  isAdmin: boolean;
  /** Users whose leads/spend are visible: the marketing user themself, or (admin) one/all marketing users */
  userIds: mongoose.Types.ObjectId[];
}

/**
 * Who may use /api/marketing/*: Marketing Executives (their own data only) and admins
 * (all marketing users, or one via ?userId=). Everyone else gets 403.
 */
export async function getMarketingScope(req: Request): Promise<{ scope?: MarketingScope; error?: NextResponse }> {
  const actor: any = await getUserFromCookies();
  if (!actor) return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };

  if (isMarketingExecutive(actor.role)) {
    return { scope: { actor, isAdmin: false, userIds: [new mongoose.Types.ObjectId(String(actor._id))] } };
  }

  if (isAdminRole(actor.role)) {
    const wanted = new URL(req.url).searchParams.get("userId");
    if (wanted && mongoose.Types.ObjectId.isValid(wanted)) {
      return { scope: { actor, isAdmin: true, userIds: [new mongoose.Types.ObjectId(wanted)] } };
    }
    const marketingUsers = await User.find({ role: { $regex: /^marketing[\s_-]*executive$/i } }).select("_id").lean();
    return { scope: { actor, isAdmin: true, userIds: marketingUsers.map((u: any) => u._id) } };
  }

  return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
}

/** ?from=YYYY-MM-DD&to=YYYY-MM-DD (IST days). Defaults to the current month. */
export function periodFromQuery(req: Request): { fromKey: string; toKey: string; start: Date; end: Date } {
  const params = new URL(req.url).searchParams;
  const today = todayKey();
  const from = params.get("from");
  const to = params.get("to");
  const fromKey = isDateKey(from) ? from : monthBoundsKey(today).first;
  const toKey = isDateKey(to) ? to : today;
  const [a, b] = fromKey <= toKey ? [fromKey, toKey] : [toKey, fromKey];
  return { fromKey: a, toKey: b, ...istDayRange(a, b) };
}

/** Case/spacing-insensitive key so "Meta Ads", "meta ads " and "META-ADS" group together. */
export const sourceKey = (s: unknown) => String(s || "").toLowerCase().replace(/[\s_-]+/g, " ").trim() || "unspecified";

export { MARKETING_ROLE };
