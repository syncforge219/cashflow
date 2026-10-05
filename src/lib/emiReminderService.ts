import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Task from "@/models/Task";
import { sendWhatsAppEmiReminder } from "@/lib/msg91";
import { studentBalanceLookupStages } from "@/lib/studentBalanceService";
import { buildFeeSchedule, type ScheduleItem } from "@/lib/feeSchedule";
import { todayKey, toDateKey, daysBetween, formatDate, dateKeyToDate } from "@/lib/dates";

export interface EmiReminderResult {
  checkedAdmissions: number;
  remindersSent: number;
  errors: string[];
  details: Array<{
    student: string;
    phone: string;
    course: string;
    amount: number;
    dueDate: string;
    status: string;
  }>;
}

/**
 * Sends the MSG91 WhatsApp fee reminder (template "feeremainderstudent") one day before an
 * instalment is due, for the amount still due on it.
 *
 * Uses the shared fee schedule (src/lib/feeSchedule.ts), so it agrees with the Pending
 * Collection and Fee Collection screens about what is due and when:
 *  - instalments come from the custom EMI plan, the generated EMI plan, the down payment, or
 *    (no plan) the balance due 30 days after admission;
 *  - what is still due comes from actual payments, not from stored isPaid flags;
 *  - "tomorrow" is the IST calendar day, regardless of the server's time zone.
 *
 * force=true sends for every instalment due in the future (manual trigger), at most once a day.
 */
export async function checkAndSendOverdueEmiReminders(options?: { force?: boolean }): Promise<EmiReminderResult> {
  await dbConnect();

  const force = options?.force === true;
  const now = new Date();
  const today = todayKey(now);

  // Only students who actually owe money, with the balance computed from non-deleted payments
  const admissions = await Admission.aggregate([
    { $match: {} },
    ...studentBalanceLookupStages(),
    { $match: { remainingBalance: { $gt: 0 } } },
  ]);
  console.log(`[EMI REMINDER] ${admissions.length} admissions with a balance. force=${force}, today(IST)=${today}`);

  const results: EmiReminderResult = {
    checkedAdmissions: admissions.length,
    remindersSent: 0,
    errors: [],
    details: [],
  };

  for (const admission of admissions) {
    try {
      const schedule = buildFeeSchedule(
        admission,
        {
          totalPaid: (Number(admission.paidAmountPaise) || 0) / 100,
          totalFee: (Number(admission.computedFinalFeePaise) || 0) / 100,
        },
        today
      );

      const lastStudentReminderKey = toDateKey(admission.lastEmiReminderSentAt);
      const toRemind = schedule.items.filter((item: ScheduleItem) => {
        if (item.dueAmount <= 0) return false;
        const daysUntilDue = daysBetween(today, item.dueDateKey);
        const inWindow = force ? daysUntilDue > 0 : daysUntilDue === 1;
        if (!inWindow) return false;
        // Once per instalment per day
        const sentKey =
          item.planIndex !== undefined
            ? toDateKey(admission.customEmiPlan?.[item.planIndex]?.reminderSentAt)
            : lastStudentReminderKey;
        return sentKey !== today;
      });

      for (const item of toRemind) {
        const phone = String(admission.mobileNumber || "").trim();
        if (!phone) {
          results.errors.push(`Skipping ${admission.fullName}: no mobile number.`);
          break;
        }

        console.log(
          `[EMI REMINDER] Sending to ${admission.fullName} (${phone}) for ${item.label} ₹${item.dueAmount}, due ${item.dueDateKey}`
        );

        const whatsappRes = await sendWhatsAppEmiReminder({
          studentName: admission.fullName || "Student",
          mobileNumber: phone,
          courseName: admission.course || "Course",
          amountDue: item.dueAmount,
          dueDate: dateKeyToDate(item.dueDateKey),
        });

        if (!whatsappRes.success) {
          console.error(`[EMI REMINDER] MSG91 FAILED for ${admission.fullName}:`, whatsappRes.error);
          results.errors.push(`Failed for ${admission.fullName} (${item.label}): ${whatsappRes.error}`);
          continue;
        }

        results.remindersSent++;

        const set: Record<string, any> = { lastEmiReminderSentAt: now };
        if (item.planIndex !== undefined) {
          set[`customEmiPlan.${item.planIndex}.reminderSentAt`] = now;
          set[`customEmiPlan.${item.planIndex}.lastReminderStatus`] = "Sent";
        }
        await Admission.updateOne({ _id: admission._id }, { $set: set });

        const dueText = formatDate(item.dueDateKey);
        try {
          await Task.create({
            title: `WhatsApp EMI Reminder Sent: ${admission.fullName} (${item.label} ₹${item.dueAmount})`,
            description: `Automated WhatsApp fee reminder sent to ${admission.fullName} (${phone}) for ${item.label} of ₹${item.dueAmount} due on ${dueText}.`,
            taskType: "EMI Recovery",
            linkedType: "Admission",
            linkedStudentName: admission.fullName,
            linkedStudentId: admission._id.toString(),
            assignedTo: admission.counsellor || "Unassigned",
            priority: "High",
            status: "Pending",
            dueDate: dateKeyToDate(item.dueDateKey),
            checklist: [
              { text: "WhatsApp fee reminder delivered to student", isCompleted: true },
              { text: "Follow-up call if payment not received by the due date", isCompleted: false },
            ],
            autoTriggerSource: "Automated WhatsApp EMI Fee Reminder Engine",
          });
        } catch (taskErr) {
          console.error("[EMI REMINDER] Failed to create CRM task:", taskErr);
        }

        results.details.push({
          student: admission.fullName || "Student",
          phone,
          course: admission.course || "Course",
          amount: item.dueAmount,
          dueDate: dueText,
          status: `WhatsApp Reminder Sent (${item.label})`,
        });
      }
    } catch (studentErr: any) {
      console.error(`[EMI REMINDER] Error processing ${admission.fullName}:`, studentErr);
      results.errors.push(`Error for ${admission.fullName}: ${studentErr.message}`);
    }
  }

  console.log(`[EMI REMINDER] Done. Sent=${results.remindersSent}, Errors=${results.errors.length}`);
  return results;
}
