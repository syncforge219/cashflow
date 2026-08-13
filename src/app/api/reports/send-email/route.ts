import { NextResponse } from "next/server";
import { sendMasterExcelReportEmail } from "@/lib/emailService";
import { getUserFromCookies } from "@/lib/helper";

export async function POST(req: Request) {
  try {
    const user = await getUserFromCookies();
    let body: any = {};
    try {
      body = await req.json();
    } catch (_) {}

    const targetEmail = body.email || user?.email;
    const startDate = body.startDate;
    const endDate = body.endDate;

    const result = await sendMasterExcelReportEmail({
      targetEmail,
      startDate,
      endDate,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Super Master Report (.xlsx) successfully emailed to ${result.recipient}!`,
        recipient: result.recipient,
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json(
        { success: false, message: result.error || "Failed to send report email." },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error in /api/reports/send-email:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to process email report request." },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email") || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

  const result = await sendMasterExcelReportEmail({
    targetEmail: email,
    startDate,
    endDate,
  });

  if (result.success) {
    return NextResponse.json({
      success: true,
      message: `Super Master Report (.xlsx) successfully emailed to ${result.recipient}!`,
      recipient: result.recipient,
      messageId: result.messageId,
    });
  } else {
    return NextResponse.json(
      { success: false, message: result.error || "Failed to send report email." },
      { status: 500 }
    );
  }
}
