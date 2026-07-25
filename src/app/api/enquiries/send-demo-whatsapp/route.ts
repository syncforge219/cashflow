import { NextResponse } from "next/server";
import { sendWhatsAppDemoReminder } from "@/lib/msg91";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      studentName,
      mobileNumber,
      courseName,
      demoDate,
      demoTime,
      demoMode,
    } = body;

    if (!mobileNumber) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing recipient mobile number.",
        },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppDemoReminder({
      studentName: studentName || "Student",
      mobileNumber,
      courseName: courseName || "Course",
      demoDate: demoDate || new Date().toISOString().split("T")[0],
      demoTime: demoTime || "11:00 AM",
      demoMode: demoMode || "Online",
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "WhatsApp demo reminder dispatched successfully via MSG91.",
        result: result.data,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: result.error || "Failed to send WhatsApp demo reminder via MSG91.",
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error sending WhatsApp demo reminder API:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to send WhatsApp demo reminder.",
      },
      { status: 500 }
    );
  }
}
