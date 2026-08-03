import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { getUserFromCookies } from "@/lib/helper";

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
    const { faceDescriptor, targetUserId } = body;

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

    userDoc.isFaceRegistered = true;
    userDoc.faceDescriptor = faceDescriptor;
    userDoc.faceRegisteredAt = new Date();

    await userDoc.save();

    return NextResponse.json({
      success: true,
      message: "Face ID registered successfully!",
      user: {
        id: userDoc._id,
        name: userDoc.name,
        email: userDoc.email,
        isFaceRegistered: userDoc.isFaceRegistered,
        faceRegisteredAt: userDoc.faceRegisteredAt,
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
