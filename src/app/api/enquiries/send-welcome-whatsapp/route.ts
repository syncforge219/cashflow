import { NextResponse } from "next/server";
import { sendWhatsAppWelcomeEnquiry } from "@/lib/msg91";

/**
 * POST /api/enquiries/send-welcome-whatsapp
 * Dispatches MSG91 WhatsApp Welcome Enquiry (welcome_enquiry template) to a candidate upon enquiry creation.
 * Body parameters:
 *   - studentName: string
 *   - mobileNumber: string
 *   - brandName: string (optional, defaults to "CADD Mantra")
 *   - courseName: string (optional, defaults to "Course")
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { studentName, mobileNumber, brandName, courseName } = body || {};

    if (!mobileNumber) {
      return NextResponse.json(
        { success: false, message: "Missing required parameter: mobileNumber." },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppWelcomeEnquiry({
      studentName: studentName || "Student",
      mobileNumber,
      brandName: brandName || "CADD Mantra",
      courseName: courseName || "Course",
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "WhatsApp welcome enquiry message dispatched successfully via MSG91 (welcome_enquiry template).",
        data: result.data,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: result.error || "Failed to send WhatsApp welcome enquiry message via MSG91.",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error sending WhatsApp welcome enquiry message:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal server error." },
      { status: 500 }
    );
  }
}
