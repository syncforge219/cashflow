import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Notification from "@/models/Notification";
import Admission from "@/models/Admission";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let query: any = {};
    if (status && status !== "All") {
      query.status = status;
    }

    const notifications = await Notification.find(query).sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      success: true,
      count: notifications.length,
      notifications
    });
  } catch (error: any) {
    console.error("Fetch Notifications Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { notificationId, action } = body; // action: "Approved" | "Rejected"

    if (!notificationId || !action) {
      return NextResponse.json(
        { success: false, error: "notificationId and action are required." },
        { status: 400 }
      );
    }

    const notif = await Notification.findById(notificationId);
    if (!notif) {
      return NextResponse.json(
        { success: false, error: "Notification not found." },
        { status: 404 }
      );
    }

    notif.status = action;
    notif.read = true;
    await notif.save();

    // If linked to an Admission, update admission's discountApprovalStatus
    if (notif.admissionId) {
      await Admission.findByIdAndUpdate(notif.admissionId, {
        $set: { discountApprovalStatus: action }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Discount request ${action.toLowerCase()} successfully!`,
      notification: notif
    });
  } catch (error: any) {
    console.error("Update Notification Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update notification" },
      { status: 500 }
    );
  }
}
