import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { signJWT } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { email, password } = body;
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanPassword = typeof password === "string" ? password : "";

    if (!cleanEmail || !cleanPassword) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!cleanEmail.includes("@")) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Connect to database safely
    try {
      await dbConnect();
    } catch (dbErr: any) {
      console.error("Database connection error in login:", dbErr);
      return NextResponse.json(
        { error: "Database connection failed. Please try again." },
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Find user by email
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      console.warn(`[Login 404] User not found in DB for email: "${cleanEmail}"`);
      return NextResponse.json(
        { error: "Account does not exist" },
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!user.password) {
      console.warn(`[Login 401] User record exists but missing password field: "${cleanEmail}"`);
      return NextResponse.json(
        { error: "Account does not exist or is disabled" },
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Compare passwords
    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(cleanPassword, user.password);
      if (!isPasswordValid && cleanPassword !== cleanPassword.trim()) {
        isPasswordValid = await bcrypt.compare(cleanPassword.trim(), user.password);
      }
    } catch (bcErr: any) {
      console.error("Bcrypt compare error:", bcErr);
      return NextResponse.json(
        { error: "Password is incorrect" },
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!isPasswordValid) {
      console.warn(`[Login 401] Password mismatch for user: "${cleanEmail}"`);
      return NextResponse.json(
        { error: "Password is incorrect" },
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const cleanRole = (user.role || "").toLowerCase().trim();
    if (cleanRole.includes("marketing")) {
      console.warn(`[Login 403] Attempted login by decommissioned marketing user: "${cleanEmail}"`);
      return NextResponse.json(
        { error: "Access denied. Marketing accounts have been decommissioned." },
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const tokenPayload = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    // Sign JWT token
    const token = await signJWT(tokenPayload);

    const responseBody = {
      success: true,
      token: token,          // Always include token for mobile/native clients
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

    // Set HTTP-only cookie on response
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 3600 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login API Outer Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
