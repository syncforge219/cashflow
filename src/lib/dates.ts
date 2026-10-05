/**
 * Single source of truth for calendar dates in the app.
 *
 * The business runs on Indian time, but servers (Vercel) run in UTC and the old code mixed
 * `toISOString().split("T")[0]` (UTC date), server-local `getDate()` and browser-local dates.
 * Anything recorded between 00:00 and 05:30 IST, or stored at IST midnight, then showed up as
 * the previous day, and "today"/"overdue" flipped depending on where the code ran.
 *
 * Rules:
 *  - A calendar date is handled as a "date key": "YYYY-MM-DD" in IST.
 *  - Any stored Date (UTC midnight, IST midnight or a full timestamp) is read via toDateKey().
 *  - Date-only values are stored with dateKeyToDate() (UTC midnight of that key), which is what
 *    `new Date("YYYY-MM-DD")` already produced across the app, so existing data stays valid.
 *
 * Works identically in the browser and on the server, in any machine time zone.
 */

export const APP_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type DateInput = Date | string | number | null | undefined;

const keyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_KEY_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** Any date-like value -> IST calendar date "YYYY-MM-DD", or "" if missing/invalid. */
export function toDateKey(value: DateInput): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (isDateKey(trimmed)) return trimmed;
    // "YYYY-MM-DDT..." without a zone is a calendar date typed by a person: keep its date part
    const local = /^(\d{4}-\d{2}-\d{2})T[^Z+]*$/.exec(trimmed);
    if (local && !/[+-]\d{2}:?\d{2}$/.test(trimmed) && isDateKey(local[1])) return local[1];
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return keyFormatter.format(d); // en-CA -> YYYY-MM-DD
}

/** Today's IST date key. */
export function todayKey(now: Date = new Date()): string {
  return toDateKey(now);
}

/** Date key -> Date to store for a date-only field (UTC midnight of that calendar day). */
export function dateKeyToDate(key: string): Date {
  if (!isDateKey(key)) throw new Error(`Invalid date "${key}" (expected YYYY-MM-DD)`);
  return new Date(`${key}T00:00:00.000Z`);
}

/** Parses user/API input into a stored date-only Date. Returns null when empty or invalid. */
export function parseDateOnly(value: DateInput): Date | null {
  const key = toDateKey(value);
  return key ? dateKeyToDate(key) : null;
}

/**
 * Start/end instants of IST calendar days, for database range queries.
 * Inclusive of both days; matches timestamps, UTC-midnight and IST-midnight stored values.
 */
export function istDayRange(fromKey: string, toKey: string = fromKey): { start: Date; end: Date } {
  const start = new Date(dateKeyToDate(fromKey).getTime() - IST_OFFSET_MS);
  const end = new Date(dateKeyToDate(toKey).getTime() - IST_OFFSET_MS + DAY_MS - 1);
  return { start, end };
}

/** Whole days from `fromKey` to `toKey` (negative when toKey is earlier). */
export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((dateKeyToDate(toKey).getTime() - dateKeyToDate(fromKey).getTime()) / DAY_MS);
}

export function addDaysKey(key: string, days: number): string {
  return new Date(dateKeyToDate(key).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Adds calendar months, clamping to month end (31 Jan + 1 month = 28/29 Feb, not 3 Mar). */
export function addMonthsKey(key: string, months: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** First and last day of the IST month containing `key`. */
export function monthBoundsKey(key: string = todayKey()): { first: string; last: string } {
  const [y, m] = key.split("-").map(Number);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { first, last };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Display a calendar date, e.g. "05 Oct 2026" (style "medium") or "05/10/2026" ("short").
 * Never shifts the day, whatever the viewer's or server's time zone.
 */
export function formatDate(value: DateInput, style: "medium" | "short" | "long" = "medium", fallback = "—"): string {
  const key = toDateKey(value);
  if (!key) return fallback;
  const [y, m, d] = key.split("-");
  if (style === "short") return `${d}/${m}/${y}`;
  if (style === "long") {
    return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", {
      timeZone: "UTC",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** Display a moment in IST, e.g. "05 Oct 2026, 02:15 pm". */
export function formatDateTime(value: DateInput, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  const time = d.toLocaleTimeString("en-IN", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  return `${formatDate(d)}, ${time}`;
}
