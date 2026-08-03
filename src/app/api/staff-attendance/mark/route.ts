import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import OfficeLocation from "@/models/OfficeLocation";
import StaffAttendance from "@/models/StaffAttendance";
import { getUserFromCookies } from "@/lib/helper";
import { isWithinOfficeRadius } from "@/lib/locationVerification";
import { compareFaceDescriptors } from "@/lib/faceVerification";

export async function POST(request: Request) {
  try {
    await dbConnect();
    const sessionUser = await getUserFromCookies();

    if (!sessionUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized access. Please log in." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { latitude, longitude, liveFaceDescriptor } = body;

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: "GPS location (latitude & longitude) is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(liveFaceDescriptor) || liveFaceDescriptor.length === 0) {
      return NextResponse.json(
        { success: false, error: "Webcam Face ID capture is required." },
        { status: 400 }
      );
    }

    // 1. Fetch Staff User details
    const userId = sessionUser._id || (sessionUser as any).id;
    const userDoc = await User.findById(userId);

    if (!userDoc) {
      return NextResponse.json(
        { success: false, error: "Staff user record not found." },
        { status: 404 }
      );
    }

    // Exclude Admin & Super Admin from marking attendance
    const userRoleLower = (userDoc.role || "").toLowerCase().trim();
    if (userRoleLower === "super admin" || userRoleLower === "admin") {
      return NextResponse.json(
        {
          success: false,
          error: "Admins and Super Admins do not mark attendance. Attendance marking is strictly for staff members.",
        },
        { status: 400 }
      );
    }

    // Check if Face ID registered
    if (!userDoc.isFaceRegistered || !userDoc.faceDescriptor || userDoc.faceDescriptor.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Your Face ID is not registered yet. Please click 'Register Face ID' first.",
          needsFaceRegistration: true,
        },
        { status: 400 }
      );
    }

    // 2. Fetch Designated Office Location for Staff's Brand
    const userBrand = (userDoc.brandScope || (userDoc as any).brand || "").trim();
    let officeLoc = null;
    if (userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global") {
      officeLoc = await OfficeLocation.findOne({ brand: { $regex: new RegExp(`^${userBrand.trim()}$`, "i") } }).lean();
    }
    if (!officeLoc) {
      officeLoc = await OfficeLocation.findOne({ brand: { $in: ["All", "All Brands", "global", ""] } }).sort({ updatedAt: -1 }).lean();
    }
    if (!officeLoc) {
      officeLoc = await OfficeLocation.findOne({}).sort({ updatedAt: -1 }).lean();
    }

    if (!officeLoc) {
      return NextResponse.json(
        {
          success: false,
          error: "Admin has not set the office location yet. Please ask the admin to upload current location.",
        },
        { status: 400 }
      );
    }

    // 3. Location Verification Check
    const locationCheck = isWithinOfficeRadius(
      Number(latitude),
      Number(longitude),
      officeLoc.latitude,
      officeLoc.longitude,
      officeLoc.radiusMeters || 200
    );

    if (!locationCheck.isWithin) {
      return NextResponse.json(
        {
          success: false,
          error: `Location Verification Failed! You are ${locationCheck.distanceMeters}m away from the office (Allowed: ${officeLoc.radiusMeters}m).`,
          locationVerified: false,
          distanceMeters: locationCheck.distanceMeters,
          radiusMeters: officeLoc.radiusMeters,
        },
        { status: 400 }
      );
    }

    // 4. Face ID Verification Check
    const faceMatchResult = compareFaceDescriptors(liveFaceDescriptor, userDoc.faceDescriptor);

    if (!faceMatchResult.isMatch) {
      return NextResponse.json(
        {
          success: false,
          error: `Face ID Verification Failed! Live scan does not match registered Face ID (Confidence: ${faceMatchResult.confidencePct}%).`,
          faceVerified: false,
          confidencePct: faceMatchResult.confidencePct,
          similarity: faceMatchResult.similarity,
        },
        { status: 400 }
      );
    }

    // 5. Mark Attendance Present
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const checkInTime = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const attendanceRecord = await StaffAttendance.findOneAndUpdate(
      { userId: userDoc._id, dateStr },
      {
        userId: userDoc._id,
        userName: userDoc.name,
        userEmail: userDoc.email,
        role: userDoc.role || "Staff",
        brand: userBrand || "All",
        date: now,
        dateStr,
        checkInTime,
        status: "Present",
        locationVerified: true,
        faceVerified: true,
        latitude: Number(latitude),
        longitude: Number(longitude),
        distanceMeters: locationCheck.distanceMeters,
        confidence: faceMatchResult.confidencePct,
        notes: `Verified via Face ID (${faceMatchResult.confidencePct}%) & GPS (${locationCheck.distanceMeters}m away)`,
      },
      { upsert: true, new: true, runValidators: true }
    );

    return NextResponse.json({
      success: true,
      message: `Attendance marked PRESENT for today (${checkInTime})!`,
      attendance: attendanceRecord,
    });
  } catch (error: any) {
    console.error("POST /api/staff-attendance/mark Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to mark staff attendance" },
      { status: 500 }
    );
  }
}
