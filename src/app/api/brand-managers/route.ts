import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    await dbConnect();
    const brandManagers = await User.find({
      role: {
        $in: [
          "brand manager",
          "centre head",
          "cfo",
          "finance manager",
        ],
      },
    }).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: brandManagers });
  } catch (error: any) {
    console.error("Error fetching managers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { firstName, lastName, email, phone, photoUrl, brandScope, password, role } = body;

    if (!firstName || !lastName || !email || !password || !brandScope) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const targetRole = role || (brandScope === "All Brands" ? "cfo" : "centre head");

    // Create brand manager / CFO / centre head
    const newBrandManager = new User({
      name: `${firstName} ${lastName}`,
      email: cleanEmail,
      password: hashedPassword,
      role: targetRole,
      phone: phone || "",
      photoUrl: photoUrl || "",
      brandScope,
      joiningDate: new Date(),
    });

    await newBrandManager.save();

    return NextResponse.json({
      success: true,
      message: `${targetRole === "cfo" ? "CFO" : "Manager"} provisioned successfully`,
      data: newBrandManager,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating brand manager / CFO:", error);
    return NextResponse.json(
      { error: error.message || "Failed to provision user. Please try again." },
      { status: 500 }
    );
  }
}
