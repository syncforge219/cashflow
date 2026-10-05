import { toDateKey, todayKey, addMonthsKey, addDaysKey, daysBetween } from "@/lib/dates";

/**
 * One fee schedule for every collection screen (fee collection, pending collection, reminders).
 *
 * Before this, each screen rebuilt "what is due when" differently: the pending list credited
 * registration/down-payment money against EMIs, ignored generated (non-custom) EMI plans and
 * flagged students as overdue for their whole balance from admission day; the fee collection
 * page used another split; the reminder cron used a third. The same student showed different
 * due dates and amounts on each screen.
 *
 * How it works:
 *  1. Lay out what the student agreed to pay: registration (admission day), down payment
 *     (its due date) and EMIs (custom plan, or generated monthly), or a single balance item.
 *  2. Money is authoritative: outstanding = total fee - sum of actual (non-deleted) payments.
 *     The outstanding amount is assigned to the LATEST instalments first; everything earlier is
 *     covered by what was paid. This is what "pay instalments in order" means, and it stays
 *     correct even for older records whose stored instalment amounts were reduced on partial
 *     payments or whose isPaid flags drifted.
 */

export type ScheduleItemKind = "REGISTRATION" | "DOWNPAYMENT" | "EMI" | "BALANCE";
export type ScheduleItemStatus = "PAID" | "OVERDUE" | "DUE_TODAY" | "UPCOMING";

export interface ScheduleItem {
  kind: ScheduleItemKind;
  label: string;
  dueDateKey: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  status: ScheduleItemStatus;
  /** Some money paid but not the full instalment */
  partiallyPaid: boolean;
  /** Index into admission.customEmiPlan (custom EMI items only) */
  planIndex?: number;
  /** Stored paid date from the custom plan, if any */
  paidDateKey?: string;
}

export interface FeeSchedule {
  todayKey: string;
  totalFee: number;
  totalPaid: number;
  outstanding: number;
  items: ScheduleItem[];
  overdueAmount: number;
  dueTodayAmount: number;
  /** Overdue + due today: what the student should pay right now */
  amountDueNow: number;
  /** Earliest instalment that still has money due */
  nextDue: ScheduleItem | null;
  /** Days from today to nextDue (negative = overdue by that many days) */
  daysToNextDue: number | null;
  /** True when the plan is custom (editable instalments) */
  hasCustomPlan: boolean;
}

export interface FeeScheduleAdmission {
  finalFee?: number | null;
  courseFee?: number | null;
  registrationAmount?: number | null;
  downpaymentAmount?: number | null;
  downpaymentDueDate?: unknown;
  admissionDate?: unknown;
  createdAt?: unknown;
  hasEmi?: boolean | null;
  numInstallments?: number | null;
  installmentAmount?: number | null;
  customEmiPlan?: Array<{
    dueDate?: unknown;
    amount?: number | null;
    installmentName?: string;
    isPaid?: boolean;
    paidDate?: unknown;
  }> | null;
}

/** Without an instalment plan, the balance is due this many days after admission. */
export const LUMP_SUM_DUE_DAYS = 30;

const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? round2(n) : 0;
};
const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
  return `${n}${s}`;
};

export function agreedTotalFee(adm: FeeScheduleAdmission): number {
  return money(adm.finalFee) || money(adm.courseFee) || money(adm.registrationAmount);
}

export function buildFeeSchedule(
  adm: FeeScheduleAdmission,
  balance: { totalPaid: number; totalFee?: number },
  today: string = todayKey()
): FeeSchedule {
  const totalFee = balance.totalFee !== undefined ? money(balance.totalFee) : agreedTotalFee(adm);
  const totalPaid = Math.max(0, round2(Number(balance.totalPaid) || 0));
  const outstanding = Math.max(0, round2(totalFee - totalPaid));

  const admissionKey = toDateKey(adm.admissionDate as any) || toDateKey(adm.createdAt as any) || today;
  const registration = money(adm.registrationAmount);
  const downpayment = money(adm.downpaymentAmount);
  const downpaymentKey = toDateKey(adm.downpaymentDueDate as any) || admissionKey;

  type Draft = Omit<ScheduleItem, "paidAmount" | "dueAmount" | "status" | "partiallyPaid">;
  const drafts: Draft[] = [];

  if (registration > 0) {
    drafts.push({ kind: "REGISTRATION", label: "Registration", dueDateKey: admissionKey, amount: registration });
  }
  if (downpayment > 0) {
    drafts.push({ kind: "DOWNPAYMENT", label: "Down Payment", dueDateKey: downpaymentKey, amount: downpayment });
  }

  const plan = Array.isArray(adm.customEmiPlan) ? adm.customEmiPlan : [];
  const emiPrincipal = Math.max(0, round2(totalFee - registration - downpayment));
  let lastKey = drafts.length ? drafts[drafts.length - 1].dueDateKey : admissionKey;

  if (plan.length > 0) {
    plan.forEach((entry, i) => {
      const dueKey = toDateKey(entry?.dueDate as any) || addMonthsKey(admissionKey, i + 1);
      drafts.push({
        kind: "EMI",
        label: entry?.installmentName?.trim() || `${ordinal(i + 1)} Installment`,
        dueDateKey: dueKey,
        amount: money(entry?.amount),
        planIndex: i,
        paidDateKey: toDateKey(entry?.paidDate as any) || undefined,
      });
    });
  } else if (adm.hasEmi && Number(adm.numInstallments) >= 1 && emiPrincipal > 0) {
    const n = Math.floor(Number(adm.numInstallments));
    const base = money(adm.installmentAmount) || Math.floor(emiPrincipal / n);
    for (let i = 1; i <= n; i++) {
      const amount = i === n ? Math.max(0, round2(emiPrincipal - base * (n - 1))) : base;
      drafts.push({
        kind: "EMI",
        label: `${ordinal(i)} Installment`,
        dueDateKey: addMonthsKey(admissionKey, i),
        amount,
      });
    }
  } else if (emiPrincipal > 0) {
    const lumpKey = addDaysKey(admissionKey, LUMP_SUM_DUE_DAYS);
    drafts.push({
      kind: "BALANCE",
      label: "Balance Fee",
      dueDateKey: lumpKey > downpaymentKey ? lumpKey : downpaymentKey,
      amount: emiPrincipal,
    });
  }

  // Stable sort by due date (registration/down payment stay ahead of EMIs on the same day)
  const ordered = drafts
    .map((d, i) => ({ d, i }))
    .sort((a, b) => (a.d.dueDateKey === b.d.dueDateKey ? a.i - b.i : a.d.dueDateKey < b.d.dueDateKey ? -1 : 1))
    .map(({ d }) => d);

  // Money owed that no instalment accounts for (inconsistent older data): due with the last instalment
  const scheduled = round2(ordered.reduce((s, d) => s + d.amount, 0));
  if (outstanding > scheduled) {
    lastKey = ordered.length ? ordered[ordered.length - 1].dueDateKey : addDaysKey(admissionKey, LUMP_SUM_DUE_DAYS);
    ordered.push({ kind: "BALANCE", label: "Unscheduled Balance", dueDateKey: lastKey, amount: round2(outstanding - scheduled) });
  }

  // Assign outstanding to the latest instalments first
  let left = outstanding;
  const dueAmounts = new Array<number>(ordered.length).fill(0);
  for (let i = ordered.length - 1; i >= 0 && left > 0; i--) {
    const due = Math.min(ordered[i].amount, left);
    dueAmounts[i] = round2(due);
    left = round2(left - due);
  }

  const items: ScheduleItem[] = ordered.map((d, i) => {
    const dueAmount = dueAmounts[i];
    const paidAmount = round2(d.amount - dueAmount);
    let status: ScheduleItemStatus = "PAID";
    if (dueAmount > 0) {
      status = d.dueDateKey < today ? "OVERDUE" : d.dueDateKey === today ? "DUE_TODAY" : "UPCOMING";
    }
    return { ...d, paidAmount, dueAmount, status, partiallyPaid: dueAmount > 0 && paidAmount > 0 };
  });

  const overdueAmount = round2(items.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + i.dueAmount, 0));
  const dueTodayAmount = round2(items.filter((i) => i.status === "DUE_TODAY").reduce((s, i) => s + i.dueAmount, 0));
  const nextDue = items.find((i) => i.dueAmount > 0) || null;

  return {
    todayKey: today,
    totalFee,
    totalPaid,
    outstanding,
    items,
    overdueAmount,
    dueTodayAmount,
    amountDueNow: round2(overdueAmount + dueTodayAmount),
    nextDue,
    daysToNextDue: nextDue ? daysBetween(today, nextDue.dueDateKey) : null,
    hasCustomPlan: plan.length > 0,
  };
}

export type AgingBucket =
  | "overdue1to30"
  | "overdue31to60"
  | "overdue61to90"
  | "overdue90Plus"
  | "dueToday"
  | "next7Days"
  | "next15Days"
  | "next30Days"
  | "later";

export const OVERDUE_BUCKETS: AgingBucket[] = ["overdue1to30", "overdue31to60", "overdue61to90", "overdue90Plus"];

/**
 * Aging of a student's dues, from the earliest unpaid instalment.
 * `amount` is what belongs in that bucket: everything due now when overdue/due today,
 * otherwise the next instalment. Returns null when nothing is outstanding.
 */
export function agingOf(schedule: FeeSchedule): { bucket: AgingBucket; label: string; amount: number; days: number } | null {
  const next = schedule.nextDue;
  if (!next || schedule.daysToNextDue === null) return null;
  const days = schedule.daysToNextDue;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  if (days < 0) {
    const late = -days;
    const bucket: AgingBucket =
      late <= 30 ? "overdue1to30" : late <= 60 ? "overdue31to60" : late <= 90 ? "overdue61to90" : "overdue90Plus";
    return { bucket, label: `${plural(late, "Day")} Overdue`, amount: schedule.amountDueNow, days };
  }
  if (days === 0) {
    return { bucket: "dueToday", label: "Due Today", amount: schedule.dueTodayAmount, days };
  }
  const bucket: AgingBucket = days <= 7 ? "next7Days" : days <= 15 ? "next15Days" : days <= 30 ? "next30Days" : "later";
  return { bucket, label: `Due in ${plural(days, "Day")}`, amount: next.dueAmount, days };
}

/**
 * Brings the stored customEmiPlan isPaid/paidDate flags in line with the schedule.
 * The flags are only informational (reminders, older screens); amounts are never changed.
 * Returns true if anything changed.
 */
export function syncCustomPlanFlags(
  customEmiPlan: Array<{ isPaid?: boolean; paidDate?: unknown }> | null | undefined,
  schedule: FeeSchedule,
  paidOn: Date = new Date()
): boolean {
  if (!Array.isArray(customEmiPlan) || customEmiPlan.length === 0) return false;
  let changed = false;
  for (const item of schedule.items) {
    if (item.kind !== "EMI" || item.planIndex === undefined) continue;
    const entry = customEmiPlan[item.planIndex];
    if (!entry) continue;
    const paid = item.dueAmount === 0;
    if (Boolean(entry.isPaid) !== paid) {
      entry.isPaid = paid;
      entry.paidDate = paid ? entry.paidDate || paidOn : null;
      changed = true;
    }
  }
  return changed;
}
