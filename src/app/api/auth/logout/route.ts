import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getRawSessionToken, destroySession } from "@/lib/auth";

export async function POST() {
  try {
    const rawToken = await getRawSessionToken();
    if (rawToken) {
      await destroySession(rawToken);
    }

    const cookieStore = await cookies();
    cookieStore.delete("token");
    cookieStore.delete("session_token");

    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

