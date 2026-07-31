import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Batch from "@/models/Batch";
import User from "@/models/User";
import { getUserFromCookies } from "@/lib/helper";

export async function GET(request: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const { searchParams } = new URL(request.url);
    let brand = searchParams.get("brand");
    const teacherId = searchParams.get("teacherId");
    const status = searchParams.get("status");
    const course = searchParams.get("course");

    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    const isBrandRestricted = userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";

    if (isBrandRestricted) {
      brand = userBrand;
    }

    const query: any = {};
    if (brand && brand !== "All Brands" && brand !== "All") {
      query.brand = { $regex: new RegExp(`^${brand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") };
    }
    if (teacherId) {
      query.teacherId = teacherId;
    }
    if (status && status !== "All Status") {
      query.status = status;
    }
    if (course) {
      query.course = { $regex: new RegExp(course.trim(), "i") };
    }

    const batches = await Batch.find(query).sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      count: batches.length,
      data: batches,
      batches,
    });
  } catch (error: any) {
    console.error("GET /api/batches Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch batches" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();

    const {
      batchName,
      course,
      courseCode,
      teacherId,
      teacherName,
      brand,
      startDate,
      endDate,
      timing,
      days,
      maxCapacity,
      notes,
      createdBy,
      creatorRole,
    } = body;

    if (!batchName || !course || !teacherId || !brand || !startDate || !timing) {
      return NextResponse.json(
        {
          success: false,
          error: "Batch Name, Course, Faculty, Brand, Start Date, and Timing are required.",
        },
        { status: 400 }
      );
    }

    // Verify assigned teacher exists
    let assignedFacultyName = teacherName;
    if (teacherId) {
      const teacher = await User.findById(teacherId);
      if (teacher) {
        assignedFacultyName = teacher.name;
      }
    }

    const newBatch = await Batch.create({
      batchName,
      course,
      courseCode: courseCode?.trim() || undefined,
      teacherId,
      teacherName: assignedFacultyName || "Unassigned Faculty",
      brand,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      timing,
      days: Array.isArray(days) ? days : [days].filter(Boolean),
      maxCapacity: Number(maxCapacity) || 30,
      notes,
      createdBy: createdBy || "System User",
      creatorRole: creatorRole || "super admin",
      status: "Upcoming",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Faculty batch created successfully",
        data: newBatch,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/batches Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create batch" },
      { status: 500 }
    );
  }
}
