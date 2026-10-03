import { NextResponse } from "next/server";
import { escapeRegex } from "@/lib/helper";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { getAuthenticatedUser } from "@/lib/auth";

// Only super admins / admins may manage system user accounts.
async function requireUserAdmin() {
  const sessionUser = await getAuthenticatedUser();
  if (!sessionUser) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  const role = (sessionUser.role || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (role !== "superadmin" && role !== "admin") {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { sessionUser };
}

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const roleFilter = searchParams.get("role");
    const searchQuery = searchParams.get("search");

    let query: any = {};

    if (roleFilter && roleFilter !== "all") {
      query.role = { $regex: escapeRegex(roleFilter), $options: "i" };
    }

    if (searchQuery) {
      query.$or = [
        { name: { $regex: escapeRegex(searchQuery), $options: "i" } },
        { email: { $regex: escapeRegex(searchQuery), $options: "i" } },
        { phone: { $regex: escapeRegex(searchQuery), $options: "i" } },
        { role: { $regex: escapeRegex(searchQuery), $options: "i" } },
      ];
    }

    const users = await User.find(query).select("-password").sort({ createdAt: -1 });

    return NextResponse.json({ success: true, count: users.length, data: users });
  } catch (error: any) {
    console.error("Error fetching system users:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const auth = await requireUserAdmin();
    if (auth.error) return auth.error;
    const body = await req.json();
    const { name, email, password, role, phone, brandScope, customAppName } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "A user with this email address already exists" },
        { status: 400 }
      );
    }

    const newUser = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      // The User model has no hashing hook; login uses bcrypt.compare, so hash here.
      password: await bcrypt.hash(password, 10),
      role: role || "software developer",
      phone: phone ? phone.trim() : "",
      brandScope: brandScope || "All Brands",
      customAppName: customAppName || "Coach",
    });

    await newUser.save();

    const userObj: any = newUser.toObject();
    delete userObj.password;

    return NextResponse.json(
      {
        success: true,
        message: "System user created successfully",
        data: userObj,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create user" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    await dbConnect();
    const auth = await requireUserAdmin();
    if (auth.error) return auth.error;
    const body = await req.json();
    const { id, _id, name, email, password, role, phone, brandScope, customAppName } = body;
    const targetId = id || _id;

    if (!targetId) {
      return NextResponse.json(
        { success: false, error: "User ID is required for update" },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (role) updateData.role = role;
    if (phone !== undefined) updateData.phone = phone.trim();
    if (brandScope) updateData.brandScope = brandScope;
    if (customAppName) updateData.customAppName = customAppName;
    if (password && password.trim().length >= 6) {
      updateData.password = await bcrypt.hash(password.trim(), 10);
    }

    const updatedUser = await User.findByIdAndUpdate(targetId, updateData, { new: true }).select("-password");

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: "User account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "User account updated successfully",
      data: updatedUser,
    });
  } catch (error: any) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const auth = await requireUserAdmin();
    if (auth.error) return auth.error;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    if (String(auth.sessionUser?.id) === String(id)) {
      return NextResponse.json(
        { success: false, error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    await User.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: "User account deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete user account" },
      { status: 500 }
    );
  }
}
