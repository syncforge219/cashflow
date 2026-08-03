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
    const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const dateStr = searchParams.get("dateStr") || todayIST;
    const roleFilter = searchParams.get("role");
    const userIdFilter = searchParams.get("userId");
    let brand = searchParams.get("brand");

    const userBrand = (currentUser?.brandScope || (currentUser as any)?.brand || "").trim();
    const isBrandRestricted =
      userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";

    if (isBrandRestricted) {
      brand = userBrand;
    }

    // 1. Fetch Office Location for requested Brand
    let officeLocation = null;
    if (brand && brand !== "All" && brand !== "All Brands") {
      officeLocation = await OfficeLocation.findOne({ brand: { $regex: new RegExp(`^${brand.trim()}$`, "i") } }).lean();
    }
    if (!officeLocation) {
      officeLocation = await OfficeLocation.findOne({ brand: { $in: ["All", "All Brands", "global", ""] } }).sort({ updatedAt: -1 }).lean();
    }
    if (!officeLocation) {
      officeLocation = await OfficeLocation.findOne({}).sort({ updatedAt: -1 }).lean();
    }

    const allLocations = await OfficeLocation.find({}).sort({ brand: 1 }).lean();

    const userRoleLower = (currentUser.role || "").toLowerCase().trim();
    const isUserAdmin =
      userRoleLower === "super admin" ||
      userRoleLower === "admin" ||
      userRoleLower === "superadmin" ||
      (userRoleLower.includes("admin") && !userRoleLower.includes("manager") && !userRoleLower.includes("cfo"));

    // 2. Fetch Staff Roster (Excluding Super Admin & Admin by default from marking roster)
    const userQuery: any = {};
    if (roleFilter && roleFilter !== "All") {
      userQuery.role = roleFilter;
    } else {
      userQuery.role = { $nin: [/admin/i] };
    }
    if (brand && brand !== "All" && brand !== "All Brands") {
      userQuery.brandScope = { $regex: new RegExp(`^${brand.trim()}$`, "i") };
    }
    if (userIdFilter) {
      userQuery._id = userIdFilter;
    }

    // SECURITY: Except admins, non-admin staff can NEVER see attendance of other staff members
    if (!isUserAdmin) {
      const currentId = currentUser._id || (currentUser as any).id;
      userQuery._id = currentId;
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

    // SECURITY: Except admins, non-admin staff can NEVER see attendance of other staff members
    if (!isUserAdmin) {
      const currentId = currentUser._id || (currentUser as any).id;
      attendanceQuery.userId = currentId;
    }

    const attendanceLogs = await StaffAttendance.find(attendanceQuery)
      .sort({ createdAt: -1 })
      .lean();

    // Helper to format log checkInTime in IST timezone
    const formatLogCheckIn = (log: any) => {
      if (!log) return null;
      if (log.date || log.createdAt) {
        return new Date(log.date || log.createdAt).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        });
      }
      return log.checkInTime || null;
    };

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
        checkInTime: todayLog ? formatLogCheckIn(todayLog) : null,
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

    const formattedAttendanceLogs = attendanceLogs.map((log: any) => ({
      ...log,
      checkInTime: formatLogCheckIn(log),
    }));

    return NextResponse.json({
      success: true,
      dateStr,
      officeLocation: officeLocation || null,
      allLocations: allLocations || [],
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
        todayLog: currentUserTodayLog
          ? {
              ...currentUserTodayLog,
              checkInTime: formatLogCheckIn(currentUserTodayLog),
            }
          : null,
      },
      staffRoster,
      attendanceLogs: formattedAttendanceLogs,
    });
  } catch (error: any) {
    console.error("GET /api/staff-attendance Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch staff attendance data" },
      { status: 500 }
    );
  }
}
