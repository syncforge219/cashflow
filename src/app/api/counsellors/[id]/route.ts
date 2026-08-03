import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: "Counsellor not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "Counsellor deleted successfully" });
  } catch (error: any) {
    console.error("Delete Counsellor Error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete counsellor" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const updateData: any = { ...body };

    if (body.password !== undefined && body.password !== null) {
      const trimmedPass = String(body.password).trim();
      if (trimmedPass.length > 0) {
        if (trimmedPass.length < 6) {
          return NextResponse.json({ error: "Password must be at least 6 characters long" }, { status: 400 });
        }
        const hashedPassword = await bcrypt.hash(trimmedPass, 10);
        updateData.password = hashedPassword;
      } else {
        delete updateData.password;
      }
    } else {
      delete updateData.password;
    }

    const updated = await User.findByIdAndUpdate(id, updateData, { new: true }).select("-password");
    if (!updated) {
      return NextResponse.json({ error: "Counsellor not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, counsellor: updated });
  } catch (error: any) {
    console.error("Update Counsellor Error:", error);
    return NextResponse.json({ error: error.message || "Failed to update counsellor" }, { status: 500 });
  }
}

