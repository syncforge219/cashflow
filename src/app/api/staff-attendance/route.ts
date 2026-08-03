import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import StaffAttendance from "@/models/StaffAttendance";
import OfficeLocation from "@/models/OfficeLocation";
import { getUserFromCookies } from "@/lib/helper";

export async function GET(request: Request) {
  try {
    await dbConnect();
    const currentUser = await getUserFromCookies();

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized access" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("dateStr") || new Date().toISOString().split("T")[0];
    const roleFilter = searchParams.get("role");
    const userIdFilter = searchParams.get("userId");
    let brand = searchParams.get("brand");

    const userBrand = (currentUser?.brandScope || (currentUser as any)?.brand || "").trim();
    const isBrandRestricted =
      userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";

    if (isBrandRestricted) {
      brand = userBrand;
    }

    // 1. Fetch Office Location
    const locQuery: any = {};
    if (brand && brand !== "All" && brand !== "All Brands") {
      locQuery.brand = { $in: [brand, "All"] };
    }
    const officeLocation = await OfficeLocation.findOne(locQuery).sort({ updatedAt: -1 }).lean();

    // 2. Fetch Staff Roster (Excluding Super Admin & Admin by default from marking roster)
    const userQuery: any = {};
    if (roleFilter && roleFilter !== "All") {
      userQuery.role = roleFilter;
    } else {
      userQuery.role = { $nin: [/admin/i] };
    }
    if (brand && brand !== "All" && brand !== "All Brands") {
      userQuery.brandScope = brand;
    }
    if (userIdFilter) {
      userQuery._id = userIdFilter;
    }

    const allStaffUsers = await User.find(userQuery)
      .select("name email role brandScope isFaceRegistered faceRegisteredAt createdAt")
      .sort({ name: 1 })
      .lean();

    // 3. Fetch Staff Attendance records for specified dateStr
    const attendanceQuery: any = { dateStr };
    if (brand && brand !== "All" && brand !== "All Brands") {
      attendanceQuery.brand = brand;
    }
    if (userIdFilter) {
      attendanceQuery.userId = userIdFilter;
    }

    const attendanceLogs = await StaffAttendance.find(attendanceQuery)
      .sort({ createdAt: -1 })
      .lean();

    // Map attendance status onto staff roster
    const attendanceMap = new Map();
    attendanceLogs.forEach((log: any) => {
      attendanceMap.set(log.userId.toString(), log);
    });

    const staffRoster = allStaffUsers.map((u: any) => {
      const uIdStr = u._id.toString();
      const todayLog = attendanceMap.get(uIdStr);
      return {
        id: uIdStr,
        name: u.name,
        email: u.email,
        role: u.role || "Staff",
        brand: u.brandScope || "All",
        isFaceRegistered: Boolean(u.isFaceRegistered),
        faceRegisteredAt: u.faceRegisteredAt,
        statusToday: todayLog ? todayLog.status : "Absent",
        checkInTime: todayLog ? todayLog.checkInTime : null,
        distanceMeters: todayLog ? todayLog.distanceMeters : null,
        confidence: todayLog ? todayLog.confidence : null,
        locationVerified: todayLog ? todayLog.locationVerified : false,
        faceVerified: todayLog ? todayLog.faceVerified : false,
        attendanceId: todayLog ? todayLog._id : null,
      };
    });

    // 4. Calculate Stats
    const totalStaff = staffRoster.length;
    const totalPresent = staffRoster.filter((s) => s.statusToday === "Present").length;
    const totalAbsent = totalStaff - totalPresent;
    const totalFaceRegistered = staffRoster.filter((s) => s.isFaceRegistered).length;

    // Check current logged in user status
    const currentUserIdStr = (currentUser._id || (currentUser as any).id).toString();
    const currentUserProfile = await User.findById(currentUserIdStr).select("isFaceRegistered faceRegisteredAt").lean();
    const currentUserTodayLog = attendanceLogs.find((l: any) => l.userId.toString() === currentUserIdStr);

    return NextResponse.json({
      success: true,
      dateStr,
      officeLocation: officeLocation || null,
      stats: {
        totalStaff,
        totalPresent,
        totalAbsent,
        totalFaceRegistered,
      },
      currentUserStatus: {
        isFaceRegistered: Boolean(currentUserProfile?.isFaceRegistered),
        faceRegisteredAt: currentUserProfile?.faceRegisteredAt || null,
        isMarkedToday: Boolean(currentUserTodayLog),
        todayLog: currentUserTodayLog || null,
      },
      staffRoster,
      attendanceLogs,
    });
  } catch (error: any) {
    console.error("GET /api/staff-attendance Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch staff attendance data" },
      { status: 500 }
    );
  }
}
