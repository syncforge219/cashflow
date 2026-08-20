import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    await dbConnect();
    const softwareDevelopers = await User.find({
      role: {
        $in: [
          "software developer",
          "software_developer",
          "developer",
          "software engineer",
          "tech lead",
        ],
      },
    }).sort({ createdAt: -1 });

    return NextResponse.json({ success: true, data: softwareDevelopers });
  } catch (error: any) {
    console.error("Error fetching software developers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { name, email, phone, password, brandScope, photoUrl } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newDev = new User({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role: "software developer",
      phone: phone || "",
      photoUrl: photoUrl || "",
      brandScope: brandScope || "All Brands",
      joiningDate: new Date(),
    });

    await newDev.save();

    return NextResponse.json(
      {
        success: true,
        message: "Software Developer provisioned successfully",
        data: newDev,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating software developer:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create software developer" },
      { status: 500 }
    );
  }
}
