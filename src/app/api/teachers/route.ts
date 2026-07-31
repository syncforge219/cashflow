import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/db";
import User from "@/models/User";

import { getUserFromCookies } from "@/lib/helper";

export async function GET(request: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const { searchParams } = new URL(request.url);
    const brandScopeParam = searchParams.get("brandScope");

    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    const isBrandRestricted = userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";

    const targetBrand = isBrandRestricted ? userBrand : (brandScopeParam && brandScopeParam !== "All Brands" && brandScopeParam !== "All" ? brandScopeParam : "");

    const query: any = { role: "teacher" };
    if (targetBrand) {
      const regex = new RegExp(targetBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
      query.$or = [
        { brandScope: { $regex: regex } },
        { brandScope: { $in: ["All Brands", "All", "global", "*"] } },
        { brandScope: { $exists: false } },
        { brandScope: null },
      ];
    }

    const teachers = await User.find(query).select("-password").sort({ createdAt: -1 });

    return NextResponse.json({ success: true, teachers, data: teachers });
  } catch (error: any) {
    console.error("Error fetching teachers:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch teachers" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();

    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      photoUrl,
      brandScope,
      subject,
      subjects,
      joiningDate,
      password,
    } = body;

    // Validation
    if (!firstName || !lastName || !email || !brandScope || !password) {
      return NextResponse.json(
        { error: "Required fields (First Name, Last Name, Email, Brand Scope, Password) are missing" },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if email already registered
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const subjectsArray = Array.isArray(subjects)
      ? subjects
      : (typeof subject === "string" && subject.trim() ? [subject.trim()] : []);

    // Create user with role "teacher"
    const newTeacher = await User.create({
      name: `${firstName} ${lastName}`,
      email: cleanEmail,
      password: hashedPassword,
      role: "teacher",
      phone: phone || "",
      photoUrl: photoUrl || "",
      brandScope,
      subjects: subjectsArray,
      subject: subjectsArray,
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
    });

    const userObj = newTeacher.toObject();
    delete (userObj as any).password;

    return NextResponse.json(
      { success: true, teacher: userObj, data: userObj, message: "Teacher added successfully" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Teacher Registration API Error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred during teacher registration" },
      { status: 500 }
    );
  }
}
