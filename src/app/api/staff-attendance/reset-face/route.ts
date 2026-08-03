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
    const { targetUserId } = body;

    const userIdToReset = targetUserId || currentUser._id || (currentUser as any).id;

    const userDoc = await User.findById(userIdToReset);
    if (!userDoc) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    userDoc.isFaceRegistered = false;
    userDoc.faceDescriptor = [];
    userDoc.faceRegisteredAt = undefined;

    await userDoc.save();

    return NextResponse.json({
      success: true,
      message: `Face ID registration reset for ${userDoc.name}`,
    });
  } catch (error: any) {
    console.error("POST /api/staff-attendance/reset-face Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to reset Face ID" },
      { status: 500 }
    );
  }
}
