import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { getUserFromCookies } from "@/lib/auth";
import StudentMergeIgnore from "@/models/StudentMergeIgnore";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const user = await getUserFromCookies();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const role = (user.role || "").toLowerCase().trim();
    const isAdmin = role === "admin" || role === "super admin" || role === "super_admin";
    if (!isAdmin) {
      return NextResponse.json({ success: false, message: "Forbidden: Only Admin and Super Admin can mark records as distinct." }, { status: 403 });
    }

    const body = await req.json();
    const { recordIdA, recordIdB, phoneOrEmail } = body;

    if (!recordIdA || !recordIdB) {
      return NextResponse.json({ success: false, message: "recordIdA and recordIdB are required." }, { status: 400 });
    }

    await StudentMergeIgnore.findOneAndUpdate(
      { recordIdA, recordIdB },
      { $setOnInsert: { recordIdA, recordIdB, phoneOrEmail: phoneOrEmail || "", ignoredBy: user._id, createdAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: "Records successfully marked as distinct individuals.",
    });
  } catch (error: any) {
    console.error("Error in POST /api/students/merge-review/mark-distinct:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
