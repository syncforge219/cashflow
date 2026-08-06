import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { signJWT } from "@/lib/jwt";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit(`verify_otp_${clientIp}`, { limit: 10, windowMs: 60 * 1000 });
    if (rateCheck.isLimited) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please wait 1 minute." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, otp } = body;
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanOtp = typeof otp === "string" ? otp.trim() : "";

    if (!cleanEmail || !cleanOtp) {
      return NextResponse.json(
        { error: "Email and OTP are required" },
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

    if (!user.otp || !user.otpExpiresAt) {
      return NextResponse.json(
        { error: "No OTP request found. Please request a new OTP." },
        { status: 400 }
      );
    }

    const isExpired = new Date(user.otpExpiresAt).getTime() < Date.now();
    if (isExpired) {
      return NextResponse.json(
        { error: "OTP has expired. Please request a new OTP." },
        { status: 400 }
      );
    }

    if (user.otp !== cleanOtp) {
      return NextResponse.json(
        { error: "Invalid OTP code. Please enter the correct 6-digit code." },
        { status: 400 }
      );
    }

    // OTP Verified! Clear OTP fields
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    const tokenPayload = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const token = await signJWT(tokenPayload);

    const responseBody = {
      success: true,
      token: token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        customAppName: (user as any).customAppName || "Coach",
      },
    };

    const response = NextResponse.json(responseBody, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 3600 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Verify OTP API Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to verify OTP" },
      { status: 500 }
    );
  }
}
