import { NextResponse } from "next/server";
import { checkAndSendBirthdayReminders } from "@/lib/birthdayReminderService";

/**
 * GET /api/birthday/check-and-send
 * Scans all student admissions for birthdays today (in IST) and dispatches MSG91 happy_birthday WhatsApp template.
 */
export async function GET() {
  try {
    const results = await checkAndSendBirthdayReminders();
    return NextResponse.json({ success: true, ...results });
  } catch (error: any) {
    console.error("Error in birthday reminder API:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to check student birthdays" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/birthday/check-and-send
 * Manually trigger or force check for student birthdays.
 * Body parameter: { force: true }
 */
export async function POST(req: Request) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {}

    const force = body?.force === true;
    const results = await checkAndSendBirthdayReminders({ force });
    return NextResponse.json({ success: true, ...results });
  } catch (error: any) {
    console.error("Error in birthday reminder trigger API:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to trigger birthday reminders" },
      { status: 500 }
    );
  }
}
