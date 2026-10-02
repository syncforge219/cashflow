import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { getUserFromCookies } from "@/lib/helper";
import { eraseBiometricProfile } from "@/lib/biometricService";

/**
 * DELETE /api/staff-attendance/biometric/[userId]
 * Right to Erasure / Right to be Forgotten under DPDP Act 2023.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await dbConnect();
    const currentUser = await getUserFromCookies();

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized access" },
        { status: 401 }
      );
    }

    const { userId } = await params;
    const isSelf = String(currentUser._id || (currentUser as any).id) === String(userId);
    const isAdmin = currentUser.role?.toLowerCase().includes("admin");

    if (!isSelf && !isAdmin) {
      return NextResponse.json(
        { success: false, error: "Forbidden: You may only request erasure of your own biometric data." },
        { status: 403 }
      );
    }

    const result = await eraseBiometricProfile(userId);

    return NextResponse.json({
      success: true,
      message: "Biometric facial data has been permanently erased in compliance with the DPDP Act 2023.",
      erased: result.erased,
      userId,
      erasedAt: new Date(),
    });
  } catch (error: any) {
    console.error("DELETE /api/staff-attendance/biometric/[userId] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to erase biometric data" },
      { status: 500 }
    );
  }
}
