import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Course from "@/models/Course";
import { getUserFromCookies } from "@/lib/helper";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    const { searchParams } = new URL(req.url);
    const brandParam = searchParams.get("brand");
    
    const userBrand = (user?.brandScope || (user as any)?.brand || "").trim();
    const isBrandRestricted = userBrand && userBrand !== "All Brands" && userBrand !== "All" && userBrand !== "*" && userBrand !== "global";

    let query: any = {};
    if (isBrandRestricted) {
      query.brand = { $regex: new RegExp(`^${userBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") };
    } else if (brandParam && brandParam !== "All Brands" && brandParam !== "All") {
      const cleanParam = brandParam.trim().replace(/[^a-zA-Z0-9]/g, "");
      const regexPattern = cleanParam.split("").join(".*");
      query.brand = { $regex: new RegExp(regexPattern, "i") };
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
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const generateUniqueCodeBackend = async (providedCode?: string, brandName?: string, courseName?: string) => {
      if (providedCode && providedCode.trim()) return providedCode.trim().toUpperCase();

      let prefix = "";
      if (courseName && courseName.trim().length >= 2) {
        const words = courseName.trim().split(/\s+/);
        prefix = words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : courseName.trim().substring(0, 2).toUpperCase();
      } else if (brandName && brandName.trim().length >= 2) {
        const words = brandName.trim().split(/\s+/);
        prefix = words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : brandName.trim().substring(0, 2).toUpperCase();
      }

      prefix = prefix.replace(/[^A-Z]/gi, "").toUpperCase();
      while (prefix.length < 2) {
        prefix += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
      }

      let attempts = 0;
      while (attempts < 100) {
        const num = Math.floor(1000 + Math.random() * 9000);
        const candidate = `${prefix}${num}`;
        const existing = await Course.findOne({ code: { $regex: new RegExp(`^${candidate}$`, "i") } });
        if (!existing) return candidate;
        attempts++;
      }

      const r1 = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
      const r2 = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
      return `${r1}${r2}${Math.floor(1000 + Math.random() * 9000)}`;
    };

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    body.name = body.name?.trim() || `New Course ${randomSuffix}`;
    body.brand = body.brand?.trim() || "Cadd Mantra";
    body.code = await generateUniqueCodeBackend(body.code, body.brand, body.name);
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
