import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    await dbConnect();

    const cleanEmail = "finance@coachflow.com";
    let user = await User.findOne({
      $or: [
        { email: cleanEmail },
        { role: "finance manager" },
      ],
    });

    if (!user) {
      const hashedPassword = await bcrypt.hash("finance123", 10);
      user = await User.create({
        name: "Chief Finance Officer",
        email: cleanEmail,
        password: hashedPassword,
        role: "finance manager",
        brandScope: "All Brands",
        joiningDate: new Date(),
      });
      console.log("✅ Created Finance Manager user: finance@coachflow.com / finance123");
    } else {
      // Ensure password is standard finance123 for convenience
      const hashedPassword = await bcrypt.hash("finance123", 10);
      user.password = hashedPassword;
      user.role = "finance manager";
      user.brandScope = "All Brands";
      await user.save();
    }

    return NextResponse.json({
      success: true,
      message: "Finance Manager user ready for login",
      user: {
        name: user.name,
        email: user.email,
        password: "finance123",
        role: user.role,
        brandScope: user.brandScope,
      },
    });
  } catch (error: any) {
    console.error("Error seeding Finance Manager:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json().catch(() => ({}));
    const email = body.email ? body.email.trim().toLowerCase() : "finance@coachflow.com";
    const password = body.password || "finance123";
    const name = body.name || "Chief Finance Officer";

    let user = await User.findOne({ email });
    const hashedPassword = await bcrypt.hash(password, 10);

    if (!user) {
      user = await User.create({
        name,
        email,
        password: hashedPassword,
        role: "finance manager",
        brandScope: "All Brands",
        joiningDate: new Date(),
      });
    } else {
      user.name = name;
      user.password = hashedPassword;
      user.role = "finance manager";
      user.brandScope = "All Brands";
      await user.save();
    }

    return NextResponse.json({
      success: true,
      message: "Finance Manager user updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        password: password,
        role: user.role,
        brandScope: user.brandScope,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
