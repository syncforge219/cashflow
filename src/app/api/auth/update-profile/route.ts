import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import { getAuthenticatedUser } from "@/lib/auth";

export async function PATCH(req: Request) {
  try {
    await dbConnect();

    // Login issues opaque DB-backed session tokens, not JWTs, so resolve the user via the session.
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, email, phone, photoUrl, brandLogo, customAppName } = await req.json();

    const updateFields: any = {};
    if (name) updateFields.name = name.trim();
    if (email) updateFields.email = email.toLowerCase().trim();
    if (phone !== undefined) updateFields.phone = phone.trim();
    if (photoUrl !== undefined) updateFields.photoUrl = photoUrl.trim();
    if (brandLogo !== undefined) updateFields.brandLogo = brandLogo.trim();
    if (customAppName !== undefined) updateFields.customAppName = customAppName.trim();

    const updatedUser = await User.findByIdAndUpdate(
      sessionUser.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser._id.toString(),
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: (updatedUser as any).phone || "",
        photoUrl: (updatedUser as any).photoUrl || "",
        brandLogo: (updatedUser as any).brandLogo || "",
        customAppName: (updatedUser as any).customAppName || "Coach"
      }
    });
  } catch (error: any) {
    console.error("Update Profile Error:", error);
    if (error.code === 11000) {
      return NextResponse.json({ error: "Email is already in use" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update profile", message: error.message }, { status: 500 });
  }
}
