import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();
    const { firstName, lastName, name, email, phone, photoUrl, brandScope, subject, subjects, password } = body;

    const teacher = await User.findById(id);
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    if (email && email.toLowerCase() !== teacher.email.toLowerCase()) {
      const existingUser = await User.findOne({ email: email.toLowerCase(), _id: { $ne: id } });
      if (existingUser) {
        return NextResponse.json({ error: "Email already registered to another account" }, { status: 400 });
      }
      teacher.email = email;
    }

    if (name) {
      teacher.name = name;
    } else if (firstName && lastName) {
      teacher.name = `${firstName} ${lastName}`;
    } else if (firstName) {
      teacher.name = firstName;
    }

    if (phone !== undefined) teacher.phone = phone;
    if (photoUrl !== undefined) teacher.photoUrl = photoUrl;
    if (brandScope !== undefined) teacher.brandScope = brandScope;

    if (subjects !== undefined && Array.isArray(subjects)) {
      teacher.subjects = subjects;
      teacher.subject = subjects;
    } else if (subject !== undefined) {
      const subs = typeof subject === "string" ? [subject] : (Array.isArray(subject) ? subject : []);
      teacher.subjects = subs;
      teacher.subject = subs;
    }

    if (password && password.trim().length >= 6) {
      const salt = await bcrypt.genSalt(10);
      teacher.password = await bcrypt.hash(password, salt);
    }

    await teacher.save();

    return NextResponse.json({
      success: true,
      message: "Teacher updated successfully",
      data: teacher,
      teacher,
    });
  } catch (error: any) {
    console.error("Error updating teacher:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    const deletedTeacher = await User.findByIdAndDelete(id);

    if (!deletedTeacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Teacher deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting teacher:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
