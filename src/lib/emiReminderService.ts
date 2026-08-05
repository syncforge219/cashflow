import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Task from "@/models/Task";
import User from "@/models/User";
import { sendWhatsAppEmiReminder } from "@/lib/msg91";

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
 * Check all student admissions for overdue unpaid fee installments and dispatch
 * MSG91 WhatsApp Fee Reminder (template: "feeremainderstudent").
 *
 * Logic:
 *  1. Students WITH customEmiPlan entries: check each entry where isPaid=false AND dueDate has passed.
 *  2. Students WITHOUT customEmiPlan (or empty): if remainingBalance > 0 AND admissionDate+30 days has passed.
 */
export async function checkAndSendOverdueEmiReminders(options?: { force?: boolean }): Promise<EmiReminderResult> {
  await dbConnect();

  const force = options?.force !== false;
  const now = new Date();
  const todayStr = now.toDateString();

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const admissions = await Admission.find({});
  console.log(`[EMI REMINDER] Checking ${admissions.length} admissions. force=${force}, now=${now.toISOString()}`);

  const results: EmiReminderResult = {
    checkedAdmissions: admissions.length,
    remindersSent: 0,
    errors: [],
    details: [],
  };

  for (const admission of admissions) {
    try {
      const remainingBalance = Number(admission.remainingBalance ?? 0);
      const hasCustomEmi = Array.isArray(admission.customEmiPlan) && admission.customEmiPlan.length > 0;

      console.log(`[EMI REMINDER] ${admission.fullName} | remainingBalance=₹${remainingBalance} | hasCustomEmi=${hasCustomEmi}`);

      if (remainingBalance <= 0) {
        console.log(`[EMI REMINDER] SKIP (fully paid): ${admission.fullName}`);
        continue;
      }

      const overdueItems: Array<{
        installmentName: string;
        amount: number;
        dueDate: Date;
        installmentIndex: number;
      }> = [];

      if (hasCustomEmi) {
        // ────────────────────────────────────────────────────────────────────
        // CASE 1: Check each customEmiPlan entry — send ONLY 1 day before due date
        // ────────────────────────────────────────────────────────────────────
        for (let i = 0; i < admission.customEmiPlan.length; i++) {
          const entry = admission.customEmiPlan[i] as any;

          if (entry.isPaid === true) {
            console.log(`[EMI REMINDER] ${admission.fullName} | Inst ${i + 1}: ALREADY PAID → skip`);
            continue;
          }

          if (!entry.dueDate) {
            console.log(`[EMI REMINDER] ${admission.fullName} | Inst ${i + 1}: NO DUE DATE → skip`);
            continue;
          }

          const dueDate = new Date(entry.dueDate);
          const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
          const timeDiffMs = dueStart.getTime() - todayStart.getTime();
          const daysDifference = Math.round(timeDiffMs / (1000 * 60 * 60 * 24));

          // Rule: Send reminder ONLY 1 day before installment due date (daysDifference === 1).
          // No repeated daily messages on due date or overdue dates.
          const isOneDayPrior = daysDifference === 1;
          const shouldSendReminder = isOneDayPrior || (force && daysDifference > 0);

          const lastSentDateStr = entry.reminderSentAt
            ? new Date(entry.reminderSentAt).toDateString()
            : null;

          console.log(`[EMI REMINDER] ${admission.fullName} | Inst ${i + 1}: dueDate=${dueDate.toISOString().split("T")[0]}, daysUntilDue=${daysDifference}, isOneDayPrior=${isOneDayPrior}, shouldSend=${shouldSendReminder}, lastSent=${lastSentDateStr}`);

          if (shouldSendReminder) {
            if (force || !lastSentDateStr || lastSentDateStr !== todayStr) {
              const instLabel = `${i + 1}${i + 1 === 1 ? "st" : i + 1 === 2 ? "nd" : i + 1 === 3 ? "rd" : "th"} Installment`;
              overdueItems.push({
                installmentName: instLabel,
                amount: Number(entry.amount) || remainingBalance,
                dueDate,
                installmentIndex: i,
              });
            }
          }
        }
      } else {
        // ────────────────────────────────────────────────────────────────────
        // CASE 2: No EMI plan — check 30 days after admission date (1 day prior)
        // ────────────────────────────────────────────────────────────────────
        const admissionDate = new Date(admission.admissionDate || admission.createdAt || now);
        const dueDate = new Date(admissionDate);
        dueDate.setDate(dueDate.getDate() + 30);

        const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const timeDiffMs = dueStart.getTime() - todayStart.getTime();
        const daysDifference = Math.round(timeDiffMs / (1000 * 60 * 60 * 24));

        const isOneDayPrior = daysDifference === 1;
        const shouldSendReminder = isOneDayPrior || (force && daysDifference > 0);

        const lastSentDateStr = admission.lastEmiReminderSentAt
          ? new Date(admission.lastEmiReminderSentAt).toDateString()
          : null;

        console.log(`[EMI REMINDER] ${admission.fullName} | (No EMI) remaining=₹${remainingBalance}, dueDate=${dueDate.toISOString().split("T")[0]}, daysUntilDue=${daysDifference}, isOneDayPrior=${isOneDayPrior}, lastSent=${lastSentDateStr}`);

        if (shouldSendReminder && (force || !lastSentDateStr || lastSentDateStr !== todayStr)) {
          overdueItems.push({
            installmentName: "Outstanding Balance",
            amount: remainingBalance,
            dueDate,
            installmentIndex: 0,
          });
        }
      }

      console.log(`[EMI REMINDER] ${admission.fullName} — Overdue items to dispatch: ${overdueItems.length}`);

      // ──────────────────────────────────────────────────────────────────────
      // Dispatch MSG91 WhatsApp for all overdue items
      // ──────────────────────────────────────────────────────────────────────
      for (const item of overdueItems) {
        const phone = String(admission.mobileNumber || "").trim();
        if (!phone) {
          results.errors.push(`Skipping ${admission.fullName}: no mobile number.`);
          continue;
        }

        console.log(`[EMI REMINDER] Dispatching MSG91 to ${admission.fullName} (${phone}) for ${item.installmentName} ₹${item.amount}, due ${item.dueDate.toISOString().split("T")[0]}...`);

        const whatsappRes = await sendWhatsAppEmiReminder({
          studentName: admission.fullName || "Student",
          mobileNumber: phone,
          courseName: admission.course || "Course",
          amountDue: item.amount,
          dueDate: item.dueDate,
        });

        console.log(`[EMI REMINDER] MSG91 result for ${admission.fullName}:`, JSON.stringify(whatsappRes));

        if (whatsappRes.success) {
          results.remindersSent++;

          // Counsellor reminder (feeremindercounsellor) disabled per requirement.

          // Mark reminder sent timestamp
          if (hasCustomEmi && Array.isArray(admission.customEmiPlan) && admission.customEmiPlan[item.installmentIndex]) {
            (admission.customEmiPlan[item.installmentIndex] as any).reminderSentAt = now;
            (admission.customEmiPlan[item.installmentIndex] as any).lastReminderStatus = "Sent";
          }
          (admission as any).lastEmiReminderSentAt = now;
          await admission.save();

          // Create SOP task for CRM
          try {
            await Task.create({
              title: `WhatsApp EMI Reminder Sent: ${admission.fullName} (${item.installmentName} ₹${item.amount})`,
              description: `Automated WhatsApp fee reminder sent to ${admission.fullName} (${phone}) for ${item.installmentName} of ₹${item.amount} due on ${item.dueDate.toLocaleDateString("en-IN")}.`,
              taskType: "EMI Recovery",
              linkedStudentName: admission.fullName,
              linkedStudentId: admission._id.toString(),
              assignedTo: admission.counsellor || "Unassigned",
              priority: "High",
              status: "Pending",
              dueDate: now,
              checklist: [
                { text: "WhatsApp fee reminder delivered to student", isCompleted: true },
                { text: "Follow-up call if payment not received within 24h", isCompleted: false },
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
            amount: item.amount,
            dueDate: item.dueDate.toLocaleDateString("en-IN"),
            status: `WhatsApp Reminder Sent (${item.installmentName})`,
          });
        } else {
          console.error(`[EMI REMINDER] MSG91 FAILED for ${admission.fullName}:`, whatsappRes.error);
          results.errors.push(`Failed for ${admission.fullName} (${item.installmentName}): ${whatsappRes.error}`);
        }
      }
    } catch (studentErr: any) {
      console.error(`[EMI REMINDER] Error processing ${admission.fullName}:`, studentErr);
      results.errors.push(`Error for ${admission.fullName}: ${studentErr.message}`);
    }
  }

  console.log(`[EMI REMINDER] Done. Sent=${results.remindersSent}, Errors=${results.errors.length}`);
  return results;
}
