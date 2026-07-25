import { checkAndSendOverdueEmiReminders } from "@/lib/emiReminderService";

/**
 * Initialize automatic daily background worker for overdue EMI WhatsApp reminders.
 * Fires once every day at or after 16:00 IST (4:00 PM IST).
 *
 * Safe to call multiple times — checks if already scheduled/run today.
 */
export function initEmiReminderCron() {
  // Clear any previously registered interval (survives hot-reload)
  if ((global as any).__emiCronIntervalId) {
    clearInterval((global as any).__emiCronIntervalId);
    (global as any).__emiCronIntervalId = null;
  }

  console.log("⚡ [EMI CRON] Daily overdue EMI WhatsApp reminder worker initialized (Scheduled for 16:00 IST daily).");

  // Check function to run time evaluation
  const checkTimeAndTrigger = () => {
    try {
      const now = new Date();

      // Get current date and time in IST (Asia/Kolkata)
      const options: Intl.DateTimeFormatOptions = { timeZone: "Asia/Kolkata" };
      const istDateStr = now.toLocaleDateString("en-CA", options); // "YYYY-MM-DD"
      
      const timeString = now.toLocaleTimeString("en-US", {
        ...options,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }); // "16:14" or "09:05"

      const [hourStr, minStr] = timeString.split(":");
      const istHour = parseInt(hourStr, 10);
      const istMinute = parseInt(minStr, 10);

      // Target: At or after 16:00 IST (4:00 PM IST)
      const isPastTargetTime = istHour > 16 || (istHour === 16 && istMinute >= 0);
      const lastFiredDate = (global as any).__emiCronLastFiredDate;

      if (isPastTargetTime && lastFiredDate !== istDateStr) {
        (global as any).__emiCronLastFiredDate = istDateStr;
        console.log(`🕓 [EMI CRON] Triggering daily 16:00 IST overdue EMI check (Date: ${istDateStr}, Time: ${timeString} IST)...`);
        runEmiCheckSilently();
      }
    } catch (err) {
      console.error("[EMI CRON] Time check error:", err);
    }
  };

  // Run initial check immediately
  checkTimeAndTrigger();

  // Re-check every minute (60,000 ms)
  const intervalId = setInterval(checkTimeAndTrigger, 60 * 1000);
  (global as any).__emiCronIntervalId = intervalId;
}

let isCronRunning = false;

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
