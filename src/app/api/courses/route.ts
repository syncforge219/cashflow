import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Course from "@/models/Course";
import { getUserFromCookies } from "@/lib/helper";

export async function GET() {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    
    let query: any = {};
    if (user && user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All") {
      query.brand = user.brandScope;
    }

    const courses = await Course.find(query).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: courses });
  } catch (error: any) {
    console.error("Error fetching courses:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch courses" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const body = await req.json();

    if (user && user.brandScope && user.brandScope !== "All Brands" && user.brandScope !== "All") {
      body.brand = body.brand || user.brandScope;
    }

    // Fallbacks for optional form fields
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    body.name = body.name?.trim() || `New Course ${randomSuffix}`;
    body.code = body.code?.trim() || `CRS-${randomSuffix}`;
    body.brand = body.brand?.trim() || "Cadd Mantra";
    body.category = body.category?.trim() || "General";
    body.duration = body.duration?.trim() || "6 Months";
    body.fee = body.fee?.trim() || "₹0";

    // Check if course code or name already exists (case-insensitive)
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const checkConditions: any[] = [];
    if (body.code) {
      checkConditions.push({ code: { $regex: new RegExp(`^${escapeRegExp(String(body.code).trim())}$`, "i") } });
    }
    if (body.name) {
      checkConditions.push({ name: { $regex: new RegExp(`^${escapeRegExp(String(body.name).trim())}$`, "i") } });
    }

    if (checkConditions.length > 0) {
      const existingCourse = await Course.findOne({ $or: checkConditions });
      if (existingCourse) {
        return NextResponse.json(
          { success: false, message: `Course '${existingCourse.name}' (Code: ${existingCourse.code}) already exists.` },
          { status: 400 }
        );
      }
    }

    const newCourse = await Course.create(body);
    return NextResponse.json(
      { success: true, data: newCourse, message: "Course created successfully" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating course:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create course" },
      { status: 500 }
    );
  }
}
