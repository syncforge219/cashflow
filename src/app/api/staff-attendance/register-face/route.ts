import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { getUserFromCookies } from "@/lib/helper";
import { enrollBiometricProfile } from "@/lib/biometricService";

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
    const { faceDescriptor, targetUserId, consent, consentGiven, consentVersion } = body;

    // DPDP Act 2023: Strict explicit consent verification
    const hasConsent = consent === true || consentGiven === true;
    if (!hasConsent) {
      return NextResponse.json(
        {
          success: false,
          error:
            "DPDP Act 2023 Compliance Requirement: Explicit consent is required before capturing and processing facial biometric data. Please review the consent notice and check the consent box.",
          consentRequired: true,
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(faceDescriptor) || faceDescriptor.length === 0) {
      return NextResponse.json(
        { success: false, error: "Valid facial descriptor vector is required." },
        { status: 400 }
      );
    }

    // Determine target user (defaults to logged in user)
    let userIdToUpdate = currentUser._id || (currentUser as any).id;
    if (targetUserId && currentUser.role?.toLowerCase().includes("admin")) {
      userIdToUpdate = targetUserId;
    }

    const userDoc = await User.findById(userIdToUpdate);
    if (!userDoc) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Enroll in isolated biometric_profiles collection with encryption
    const enrollment = await enrollBiometricProfile({
      userId: userDoc._id,
      faceDescriptor,
      consentGiven: true,
      consentVersion: consentVersion || "DPDP-2023-V1",
      enrolledBy: currentUser._id,
    });

    return NextResponse.json({
      success: true,
      message: "Face ID registered securely with encryption (DPDP Act 2023 Compliant)!",
      user: {
        id: userDoc._id,
        name: userDoc.name,
        email: userDoc.email,
        isFaceRegistered: true,
        faceRegisteredAt: enrollment.consentGivenAt,
      },
      dpdp: {
        consentGivenAt: enrollment.consentGivenAt,
        consentVersion: enrollment.consentVersion,
        expiresAt: enrollment.expiresAt,
      },
    });
  } catch (error: any) {
    console.error("POST /api/staff-attendance/register-face Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to register Face ID" },
      { status: 500 }
    );
  }
}
