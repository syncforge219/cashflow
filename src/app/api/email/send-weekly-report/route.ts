import { NextResponse } from "next/server";
import { sendWeeklyExecutiveExcelReport } from "@/lib/emailService";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await sendWeeklyExecutiveExcelReport(body.email);
    if (result.success) {
      return NextResponse.json({ success: true, message: `Weekly Excel report sent successfully to ${result.recipient}`, messageId: result.messageId });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await sendWeeklyExecutiveExcelReport();
    if (result.success) {
      return NextResponse.json({ success: true, message: `Weekly Excel report sent successfully to ${result.recipient}`, messageId: result.messageId });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
