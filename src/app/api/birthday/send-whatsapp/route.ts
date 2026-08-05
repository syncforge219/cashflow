import { NextResponse } from "next/server";
import { sendWhatsAppBirthdayReminder } from "@/lib/msg91";

/**
 * POST /api/birthday/send-whatsapp
 * Dispatches a direct MSG91 WhatsApp Birthday Wish (happy_birthday template) to a student.
 * Body parameters:
 *   - studentName: string
 *   - mobileNumber: string
 *   - brandName: string (optional, defaults to "CADD Mantra")
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { studentName, mobileNumber, brandName } = body || {};

    if (!studentName || !mobileNumber) {
      return NextResponse.json(
        { success: false, message: "Missing required parameters: studentName and mobileNumber." },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppBirthdayReminder({
      studentName,
      mobileNumber,
      brandName,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "WhatsApp birthday wish dispatched successfully via MSG91 (happy_birthday template).",
        data: result.data,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: result.error || "Failed to send WhatsApp birthday wish via MSG91.",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error sending WhatsApp birthday wish:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal server error." },
      { status: 500 }
    );
  }
}
