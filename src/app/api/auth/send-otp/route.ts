import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { sendLoginOtpEmail } from "@/lib/emailService";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit(`send_otp_${clientIp}`, { limit: 5, windowMs: 60 * 1000 });
    if (rateCheck.isLimited) {
      return NextResponse.json(
        { error: "Too many OTP requests. Please wait 1 minute before requesting another OTP." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email } = body;
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return NextResponse.json(
        { error: "Account with this email does not exist" },
        { status: 404 }
      );
    }

    const cleanRole = (user.role || "").toLowerCase().trim();
    if (cleanRole.includes("marketing")) {
      return NextResponse.json(
        { error: "Access denied. Marketing accounts have been decommissioned." },
        { status: 403 }
      );
    }

    // Generate 6-digit numeric OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    user.otp = generatedOtp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    const emailRes = await sendLoginOtpEmail({
      email: cleanEmail,
      otp: generatedOtp,
      userName: user.name || "User",
    });

    if (!emailRes.success) {
      return NextResponse.json(
        { error: `Failed to dispatch email OTP: ${emailRes.error || "SMTP error"}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `OTP sent successfully to ${cleanEmail}. Valid for 5 minutes.`,
    });
  } catch (error: any) {
    console.error("Send OTP API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to send OTP" },
      { status: 500 }
    );
  }
}
