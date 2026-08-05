import dbConnect from "@/lib/db";
import User from "@/models/User";
import { checkAndSendOverdueEmiReminders } from "@/lib/emiReminderService";
import { checkAndSendBirthdayReminders } from "@/lib/birthdayReminderService";
import { getDailyReportStats, getMonthlyReportStats } from "@/lib/dailyReportService";
import { sendWhatsAppDailyReport, sendWhatsAppMonthlyReport } from "@/lib/msg91";

/**
 * Initialize automatic background cron workers for:
 * 1. Daily Overdue EMI WhatsApp reminders (Fires at 16:00 IST / 4:00 PM IST)
 * 2. Student Birthday WhatsApp wishes (Fires daily at 09:00 IST / 9:00 AM IST using "happy_birthday" template)
 * 3. Daily Collection Report to Admin on WhatsApp (Fires at 19:00 IST / 7:00 PM IST using "dailyreport" template)
 * 4. Monthly Collection Report to Admin on WhatsApp (Fires on 1st of every month at 19:00 IST / 7:00 PM IST)
 *
 * Safe to call multiple times — checks if already scheduled/run today.
 */
export function initEmiReminderCron() {
  // Clear any previously registered interval (survives hot-reload)
  if ((global as any).__emiCronIntervalId) {
    clearInterval((global as any).__emiCronIntervalId);
    (global as any).__emiCronIntervalId = null;
  }

  console.log("⚡ [AUTOMATED CRON WORKER] Initialized: Student Birthday (09:00 IST), Daily Overdue EMI (16:00 IST), Daily Report (19:00 IST), Monthly Report (1st of month at 19:00 IST).");

  // Check function to run time evaluation
  const checkTimeAndTrigger = () => {
    try {
      const now = new Date();

      // Get current date and time in IST (Asia/Kolkata)
      const options: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata" };
      const istDateStr = now.toLocaleDateString("en-CA", options); // "YYYY-MM-DD"
      const [istYear, istMonth, istDayStr] = istDateStr.split("-");
      const istDay = parseInt(istDayStr, 10);
      
      const timeString = now.toLocaleTimeString("en-US", {
        ...options,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }); // "19:00" or "16:00"

      const [hourStr, minStr] = timeString.split(":");
      const istHour = parseInt(hourStr, 10);
      const istMinute = parseInt(minStr, 10);

      // -------------------------------------------------------------------
      // TRIGGER 0: Daily Birthday Check (At or after 09:00 IST / 9:00 AM)
      // -------------------------------------------------------------------
      const isPast0900 = istHour > 9 || (istHour === 9 && istMinute >= 0);
      const lastBirthdayFiredDate = (global as any).__birthdayCronLastFiredDate;

      if (isPast0900 && lastBirthdayFiredDate !== istDateStr) {
        (global as any).__birthdayCronLastFiredDate = istDateStr;
        console.log(`🎂 [BIRTHDAY CRON] Triggering 09:00 IST daily student birthday check (Date: ${istDateStr})...`);
        runBirthdayCheckSilently();
      }

      // -------------------------------------------------------------------
      // TRIGGER 1: Daily Overdue EMI Check (At or after 16:00 IST / 4:00 PM)
      // -------------------------------------------------------------------
      const isPast1600 = istHour > 16 || (istHour === 16 && istMinute >= 0);
      const lastEmiFiredDate = (global as any).__emiCronLastFiredDate;

      if (isPast1600 && lastEmiFiredDate !== istDateStr) {
        (global as any).__emiCronLastFiredDate = istDateStr;
        console.log(`🕓 [EMI CRON] Triggering 16:00 IST overdue EMI check (Date: ${istDateStr})...`);
        runEmiCheckSilently();
      }

      // -------------------------------------------------------------------
      // TRIGGER 2: Daily Collection Report to Admin on WhatsApp (Every day at 7:00 PM IST / 19:00 IST using "dailyreport" template)
      // -------------------------------------------------------------------
      const isPast1900 = istHour > 19 || (istHour === 19 && istMinute >= 0);
      const lastDailyReportDate = (global as any).__dailyReportLastFiredDate;

      if (isPast1900 && lastDailyReportDate !== istDateStr) {
        (global as any).__dailyReportLastFiredDate = istDateStr;
        console.log(`📲 [DAILY REPORT CRON] Triggering 7:00 PM (19:00 IST) Daily Collection WhatsApp Report (template: dailyreport) to Admin...`);
        runDailyReportSilently();
      }

      // -------------------------------------------------------------------
      // TRIGGER 3: Monthly Collection Report to Admin on WhatsApp (Every 1st of month at 7:00 PM IST / 19:00 IST)
      // -------------------------------------------------------------------
      const currentMonthKey = `${istYear}-${istMonth}`;
      const lastMonthlyReportMonth = (global as any).__monthlyReportLastFiredMonth;

      if (istDay === 1 && isPast1900 && lastMonthlyReportMonth !== currentMonthKey) {
        (global as any).__monthlyReportLastFiredMonth = currentMonthKey;
        console.log(`📊 [MONTHLY REPORT CRON] Triggering Monthly Collection WhatsApp Report to Admin (1st of month ${currentMonthKey} at 19:00 IST)...`);
        runMonthlyReportSilently();
      }

    } catch (err) {
      console.error("[CRON WORKER] Time check error:", err);
    }
  };

  // Run initial check immediately
  checkTimeAndTrigger();

  // Re-check every minute (60,000 ms)
  const intervalId = setInterval(checkTimeAndTrigger, 60 * 1000);
  (global as any).__emiCronIntervalId = intervalId;
}

let isCronRunning = false;
let isBirthdayCronRunning = false;
let isDailyReportRunning = false;
let isMonthlyReportRunning = false;

async function runBirthdayCheckSilently() {
  if (isBirthdayCronRunning) return;
  isBirthdayCronRunning = true;
  try {
    const res = await checkAndSendBirthdayReminders({ force: false });
    console.log(`✅ [BIRTHDAY CRON] Completed check. Birthday wishes sent: ${res.wishesSent}, Errors: ${res.errors.length}`);
  } catch (err) {
    console.error("❌ [BIRTHDAY CRON] Background execution error:", err);
  } finally {
    isBirthdayCronRunning = false;
  }
}

async function runEmiCheckSilently() {
  if (isCronRunning) return;
  isCronRunning = true;
  try {
    const res = await checkAndSendOverdueEmiReminders({ force: false });
    console.log(`✅ [EMI CRON] Completed check. Reminders sent: ${res.remindersSent}, Errors: ${res.errors.length}`);
    if (res.remindersSent > 0) {
      console.log("[EMI CRON] Dispatched details:", res.details.map(d => `${d.student} → ${d.status}`).join(" | "));
    }
    if (res.errors.length > 0) {
      console.warn("[EMI CRON] Errors/notices:", res.errors);
    }
  } catch (err) {
    console.error("❌ [EMI CRON] Background execution error:", err);
  } finally {
    isCronRunning = false;
  }
}

async function runDailyReportSilently() {
  if (isDailyReportRunning) return;
  isDailyReportRunning = true;
  try {
    await dbConnect();
    let adminPhone = (process.env.ADMIN_WHATSAPP_NUMBER || process.env.ADMIN_PHONE || "").trim();

    if (!adminPhone) {
      const adminUser = await User.findOne({
        role: { $in: ["super admin", "super_admin", "admin"] },
        phone: { $exists: true, $ne: "" },
      }).lean();
      if (adminUser && (adminUser as any).phone) {
        adminPhone = (adminUser as any).phone;
      }
    }

    if (!adminPhone) {
      const envNumRaw = process.env.MSG91_INTEGRATED_NUMBER || "";
      adminPhone = envNumRaw.split(",")[0]?.trim() || "919335913286";
    }

    const stats = await getDailyReportStats();
    const res = await sendWhatsAppDailyReport({
      adminMobileNumber: adminPhone,
      reportData: stats,
    });
    console.log(`✅ [DAILY REPORT CRON] Dispatched Daily Collection Report (template: dailyreport) at 7:00 PM IST to Admin (${adminPhone}). Success: ${res.success}`);
  } catch (err) {
    console.error("❌ [DAILY REPORT CRON] Background execution error:", err);
  } finally {
    isDailyReportRunning = false;
  }
}

async function runMonthlyReportSilently() {
  if (isMonthlyReportRunning) return;
  isMonthlyReportRunning = true;
  try {
    await dbConnect();
    let adminPhone = (process.env.ADMIN_WHATSAPP_NUMBER || process.env.ADMIN_PHONE || "").trim();

    if (!adminPhone) {
      const adminUser = await User.findOne({
        role: { $in: ["super admin", "super_admin", "admin"] },
        phone: { $exists: true, $ne: "" },
      }).lean();
      if (adminUser && (adminUser as any).phone) {
        adminPhone = (adminUser as any).phone;
      }
    }

    if (!adminPhone) {
      const envNumRaw = process.env.MSG91_INTEGRATED_NUMBER || "";
      adminPhone = envNumRaw.split(",")[0]?.trim() || "919335913286";
    }

    const stats = await getMonthlyReportStats();
    const res = await sendWhatsAppMonthlyReport({
      adminMobileNumber: adminPhone,
      reportData: stats,
    });
    console.log(`✅ [MONTHLY REPORT CRON] Dispatched Monthly Collection Report at 7:00 PM IST to Admin (${adminPhone}). Success: ${res.success}`);
  } catch (err) {
    console.error("❌ [MONTHLY REPORT CRON] Background execution error:", err);
  } finally {
    isMonthlyReportRunning = false;
  }
}
