import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { getUserFromCookies } from "@/lib/helper";
import { eraseBiometricProfile } from "@/lib/biometricService";

export async function POST(request: Request) {
  try {
    await dbConnect();
    const currentUser = await getUserFromCookies();

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized access" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { targetUserId } = body;

    const userIdToReset = targetUserId || currentUser._id || (currentUser as any).id;

    const userDoc = await User.findById(userIdToReset);
    if (!userDoc) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Permanently erase biometric profile and clear User face fields
    await eraseBiometricProfile(userDoc._id);

    return NextResponse.json({
      success: true,
      message: `Face ID registration and biometric profile permanently erased for ${userDoc.name} (DPDP Act 2023 compliant).`,
    });
  } catch (error: any) {
    console.error("POST /api/staff-attendance/reset-face Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reset Face ID" },
      { status: 500 }
    );
  }
}
