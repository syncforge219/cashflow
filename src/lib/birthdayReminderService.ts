import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import { sendWhatsAppBirthdayReminder } from "@/lib/msg91";

export interface BirthdayReminderResult {
  checkedAdmissions: number;
  wishesSent: number;
  errors: string[];
  details: Array<{
    student: string;
    phone: string;
    brand: string;
    dob: string;
    status: string;
  }>;
}

/**
 * Parse various date of birth formats (YYYY-MM-DD, DD/MM/YYYY, ISO strings, etc.)
 * Returns { month: number (0-11), day: number (1-31) } or null if invalid.
 */
function parseDobMonthAndDay(dobStr?: string | null): { month: number; day: number } | null {
  if (!dobStr || typeof dobStr !== "string") return null;
  const clean = dobStr.trim();
  if (!clean) return null;

  // Format 1: YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(clean)) {
    const parts = clean.split(/[-/]/);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!isNaN(m) && !isNaN(d) && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      return { month: m, day: d };
    }
  }

  // Format 2: DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(clean)) {
    const parts = clean.split(/[-/]/);
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    if (!isNaN(m) && !isNaN(d) && m >= 0 && m <= 11 && d >= 1 && d <= 31) {
      return { month: m, day: d };
    }
  }

  // Format 3: Fallback standard Date parsing
  try {
    const parsedDate = new Date(clean);
    if (!isNaN(parsedDate.getTime())) {
      return { month: parsedDate.getMonth(), day: parsedDate.getDate() };
    }
  } catch (_) {}

  return null;
}

/**
 * Scan all student admissions for birthdays matching today's date (in IST)
 * and send MSG91 WhatsApp Birthday Wishes (template: "happy_birthday").
 */
export async function checkAndSendBirthdayReminders(options?: { force?: boolean }): Promise<BirthdayReminderResult> {
  await dbConnect();

  const force = options?.force === true;
  const now = new Date();

  // Evaluate today's date in IST (Asia/Kolkata)
  const istOptions: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata" };
  const istDateStr = now.toLocaleDateString("en-CA", istOptions); // "YYYY-MM-DD"
  const [currentYearStr, currentMonthStr, currentDayStr] = istDateStr.split("-");
  const currentYear = parseInt(currentYearStr, 10);
  const todayMonth = parseInt(currentMonthStr, 10) - 1; // 0-indexed
  const todayDay = parseInt(currentDayStr, 10);

  const admissions = await Admission.find({});
  console.log(`[BIRTHDAY REMINDER] Checking ${admissions.length} admissions for birthdays today (${istDateStr}). force=${force}`);

  const results: BirthdayReminderResult = {
    checkedAdmissions: admissions.length,
    wishesSent: 0,
    errors: [],
    details: [],
  };

  for (const admission of admissions) {
    try {
      const studentName = String(admission.fullName || "Student").trim();
      const phone = String(admission.mobileNumber || "").trim();
      const brandName = String((admission as any).brand || (admission as any).brandName || "CADD Mantra").trim();
      const dobRaw = String((admission as any).dob || "").trim();

      if (!phone) {
        continue;
      }

      if (!dobRaw) {
        continue;
      }

      const parsedDob = parseDobMonthAndDay(dobRaw);
      if (!parsedDob) {
        continue;
      }

      const isBirthdayToday = parsedDob.month === todayMonth && parsedDob.day === todayDay;

      if (!isBirthdayToday && !force) {
        continue;
      }

      const lastSentYear = (admission as any).lastBirthdayWishSentYear;
      if (!force && lastSentYear === currentYear) {
        console.log(`[BIRTHDAY REMINDER] ${studentName} already received birthday wish for year ${currentYear} → skipping.`);
        continue;
      }

      console.log(`🎉 [BIRTHDAY REMINDER] Dispatching WhatsApp Birthday Wish (happy_birthday) to ${studentName} (${phone}), Brand: ${brandName}...`);

      const res = await sendWhatsAppBirthdayReminder({
        studentName,
        mobileNumber: phone,
        brandName,
      });

      if (res.success) {
        results.wishesSent++;
        (admission as any).lastBirthdayWishSentYear = currentYear;
        (admission as any).lastBirthdayWishSentAt = now;
        await admission.save();

        results.details.push({
          student: studentName,
          phone,
          brand: brandName,
          dob: dobRaw,
          status: "WhatsApp Birthday Wish Sent (happy_birthday)",
        });
      } else {
        console.error(`❌ [BIRTHDAY REMINDER] Failed for ${studentName}:`, res.error);
        results.errors.push(`Failed for ${studentName}: ${res.error}`);
      }
    } catch (err: any) {
      console.error(`❌ [BIRTHDAY REMINDER] Error processing ${admission.fullName}:`, err);
      results.errors.push(`Error for ${admission.fullName}: ${err.message}`);
    }
  }

  console.log(`[BIRTHDAY REMINDER] Completed check. Wishes Sent=${results.wishesSent}, Errors=${results.errors.length}`);
  return results;
}
