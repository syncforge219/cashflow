import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Task from "@/models/Task";
import User from "@/models/User";
import { sendWhatsAppEmiReminder, sendWhatsAppCounsellorEmiReminder } from "@/lib/msg91";

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
        // CASE 1: Check each customEmiPlan entry directly — isPaid=false + dueDate passed
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
          const dueStart = new Date(dueDate);
          dueStart.setHours(0, 0, 0, 0);

          // Calculate exact days difference between due date and today
          const timeDiffMs = dueStart.getTime() - todayStart.getTime();
          const daysDifference = Math.round(timeDiffMs / (1000 * 60 * 60 * 24));

          // Trigger conditions:
          // 1) 3 days prior to due date (daysDifference === 3)
          // 2) Due today or overdue (daysDifference <= 0)
          const is3DaysPrior = daysDifference === 3;
          const isDueOrOverdue = daysDifference <= 0;
          const shouldSendReminder = is3DaysPrior || isDueOrOverdue;

          const lastSentDateStr = entry.reminderSentAt
            ? new Date(entry.reminderSentAt).toDateString()
            : null;

          console.log(`[EMI REMINDER] ${admission.fullName} | Inst ${i + 1}: dueDate=${dueDate.toISOString().split("T")[0]}, daysUntilDue=${daysDifference}, shouldSend=${shouldSendReminder}, lastSent=${lastSentDateStr}`);

          if (shouldSendReminder) {
            if (force || lastSentDateStr !== todayStr) {
              const statusTag = is3DaysPrior ? " (Due in 3 Days)" : isDueOrOverdue ? " (Overdue/Due Today)" : "";
              const instLabel = `${i + 1}${i + 1 === 1 ? "st" : i + 1 === 2 ? "nd" : i + 1 === 3 ? "rd" : "th"} Installment${statusTag}`;
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
        // CASE 2: No EMI plan — check if 30 days since admission has passed (or 3 days prior)
        // ────────────────────────────────────────────────────────────────────
        const admissionDate = new Date(admission.admissionDate || admission.createdAt || now);
        const dueDate = new Date(admissionDate);
        dueDate.setDate(dueDate.getDate() + 30);

        const dueStart = new Date(dueDate);
        dueStart.setHours(0, 0, 0, 0);

        const timeDiffMs = dueStart.getTime() - todayStart.getTime();
        const daysDifference = Math.round(timeDiffMs / (1000 * 60 * 60 * 24));

        const is3DaysPrior = daysDifference === 3;
        const isDueOrOverdue = daysDifference <= 0;
        const shouldSendReminder = is3DaysPrior || isDueOrOverdue;

        const lastSentDateStr = admission.lastEmiReminderSentAt
          ? new Date(admission.lastEmiReminderSentAt).toDateString()
          : null;

        console.log(`[EMI REMINDER] ${admission.fullName} | (No EMI) remaining=₹${remainingBalance}, dueDate=${dueDate.toISOString().split("T")[0]}, daysUntilDue=${daysDifference}, shouldSend=${shouldSendReminder}, lastSent=${lastSentDateStr}`);

        if (shouldSendReminder && (force || lastSentDateStr !== todayStr)) {
          const statusTag = is3DaysPrior ? " (Due in 3 Days)" : " (Overdue/Due Today)";
          overdueItems.push({
            installmentName: `Outstanding Balance${statusTag}`,
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

          // Also notify the counsellor via WhatsApp
          try {
            const counsellorName = String(admission.counsellor || "").trim();
            if (counsellorName) {
              const counsellorUser = await User.findOne({
                name: { $regex: new RegExp(`^${counsellorName}$`, "i") },
                role: "counsellor",
              });
              const counsellorPhone = counsellorUser?.phone;
              const counsellorEmail = counsellorUser?.email || "N/A";
              if (counsellorPhone) {
                const cRes = await sendWhatsAppCounsellorEmiReminder({
                  counsellorName,
                  counsellorMobile: counsellorPhone,
                  studentName: admission.fullName || "Student",
                  courseName: admission.course || "Course",
                  studentMobile: phone,
                  studentEmail: String(admission.email || "N/A"),
                  amountDue: item.amount,
                  dueDate: item.dueDate,
                });
                console.log(`[EMI REMINDER] Counsellor reminder result for ${counsellorName}:`, JSON.stringify(cRes));
              } else {
                console.warn(`[EMI REMINDER] Counsellor "${counsellorName}" has no phone number in User model — skipping counsellor WhatsApp.`);
              }
            }
          } catch (cErr: any) {
            console.error("[EMI REMINDER] Failed to send counsellor reminder:", cErr);
          }

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
