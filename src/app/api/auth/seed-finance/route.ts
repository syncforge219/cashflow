import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Auto-seeding disabled. Super Admin can add CFO / Finance Manager accounts via Team Management.",
  });
}
