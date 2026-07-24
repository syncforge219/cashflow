import { NextResponse } from "next/server";
import { checkAndSendOverdueEmiReminders } from "@/lib/emiReminderService";

export async function GET() {
  try {
    const results = await checkAndSendOverdueEmiReminders();
    return NextResponse.json({ success: true, ...results });
  } catch (error: any) {
    console.error("Error in overdue EMI check API:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to check overdue EMIs" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    let body: any = {};
    try { body = await req.json(); } catch (_) {}
    const force = body?.force !== false;

    const results = await checkAndSendOverdueEmiReminders({ force });
    return NextResponse.json({ success: true, ...results });
  } catch (error: any) {
    console.error("Error in overdue EMI check API:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to trigger overdue EMI reminders" },
      { status: 500 }
    );
  }
}
