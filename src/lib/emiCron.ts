import { checkAndSendOverdueEmiReminders } from "@/lib/emiReminderService";

/**
 * Initialize automatic daily background worker for overdue EMI WhatsApp reminders.
 * Fires once every day at 16:00 IST (10:30 UTC).
 * Uses a per-minute time check with a date guard to prevent duplicate runs.
 *
 * Safe to call multiple times — clears any existing interval before creating a new one.
 */
export function initEmiReminderCron() {
  // Clear any previously registered interval (survives hot-reload)
  if ((global as any).__emiCronIntervalId) {
    clearInterval((global as any).__emiCronIntervalId);
    (global as any).__emiCronIntervalId = null;
  }

  console.log("⚡ [EMI CRON] Daily overdue EMI WhatsApp reminder scheduled at 16:00 IST every day.");

  // Check every minute whether it is time to fire
  const intervalId = setInterval(() => {
    const now = new Date();

    // Convert current UTC time to IST (UTC+5:30)
    const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
    const ist = new Date(now.getTime() + istOffsetMs);

    const istHour = ist.getUTCHours();   // IST hour (0-23)
    const istMinute = ist.getUTCMinutes(); // IST minute (0-59)
    const istDateStr = ist.toISOString().slice(0, 10); // "YYYY-MM-DD"

    // Fire only at 16:00 IST and only once per calendar day
    if (istHour === 16 && istMinute === 0) {
      const lastFiredDate = (global as any).__emiCronLastFiredDate;
      if (lastFiredDate === istDateStr) return; // already ran today

      (global as any).__emiCronLastFiredDate = istDateStr;
      console.log(`🕓 [EMI CRON] 16:00 IST triggered (${ist.toISOString()}) — running overdue EMI check...`);
      runEmiCheckSilently();
    }
  }, 60 * 1000);

  // Store interval ID globally so it can be cleared on next hot-reload
  (global as any).__emiCronIntervalId = intervalId;
}

let isCronRunning = false;

async function runEmiCheckSilently() {
  if (isCronRunning) return;
  isCronRunning = true;
  try {
    const res = await checkAndSendOverdueEmiReminders({ force: false });
    console.log(`✅ [EMI CRON] Done. Reminders sent: ${res.remindersSent}, Errors: ${res.errors.length}`);
    if (res.remindersSent > 0) {
      console.log("[EMI CRON] Details:", res.details.map(d => `${d.student} → ${d.status}`).join(" | "));
    }
    if (res.errors.length > 0) {
      console.warn("[EMI CRON] Errors:", res.errors);
    }
  } catch (err) {
    console.error("❌ [EMI CRON] Background error:", err);
  } finally {
    isCronRunning = false;
  }
}
