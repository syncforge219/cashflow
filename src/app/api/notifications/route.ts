import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Notification from "@/models/Notification";
import Admission from "@/models/Admission";
import Enquiry from "@/models/Enquiry";
import Batch from "@/models/Batch";
import { getUserFromCookies } from "@/lib/helper";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const currentUser = await getUserFromCookies();
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") || currentUser?.role;

    // Fetch stored DB notifications
    const query: any = {};
    if (role === "teacher") {
      query.$or = [
        { targetRole: "teacher" },
        { targetRole: "all" },
        { targetTeacherId: currentUser?._id }
      ];
    }

    let notifications = await Notification.find(query).sort({ createdAt: -1 }).lean();

    // Auto-generate live notifications for faculty if empty or for live reminders
    if (role === "teacher") {
      const liveNotifs: any[] = [];

      // Check scheduled demos
      const pendingDemos = await Enquiry.find({
        isDemoScheduled: true,
        status: { $ne: "Demo Attended" }
      }).limit(5).lean();

      pendingDemos.forEach((d: any) => {
        liveNotifs.push({
          _id: `live-demo-${d._id}`,
          title: "🗓️ Demo Session Scheduled",
          message: `Demo with ${d.studentFullName || "Student"} for ${d.targetCourse || "Course"} on ${d.demoDate || "scheduled date"}.`,
          type: "demo_scheduled",
          read: false,
          createdAt: d.createdAt || new Date(),
        });
      });

      // Check active batches for attendance reminder
      const activeBatches = await Batch.find({ status: "Active" }).limit(3).lean();
      activeBatches.forEach((b: any) => {
        liveNotifs.push({
          _id: `live-batch-${b._id}`,
          title: "📋 Daily Attendance Reminder",
          message: `Please log today's student attendance for ${b.batchName} (${b.course}).`,
          type: "attendance_reminder",
          read: false,
          createdAt: b.createdAt || new Date(),
        });
      });

      notifications = [...liveNotifs, ...notifications];
    }

    return NextResponse.json({
      success: true,
      count: notifications.length,
      notifications,
      data: notifications,
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
    const { notificationId, action, markAllRead } = body;

    if (markAllRead) {
      await Notification.updateMany({ read: false }, { $set: { read: true, status: "Read" } });
      return NextResponse.json({
        success: true,
        message: "All notifications marked as read",
      });
    }

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: "notificationId is required." },
        { status: 400 }
      );
    }

    if (notificationId.startsWith("live-")) {
      return NextResponse.json({
        success: true,
        message: "Live notification marked as read",
      });
    }

    const notif = await Notification.findById(notificationId);
    if (!notif) {
      return NextResponse.json(
        { success: false, error: "Notification not found." },
        { status: 404 }
      );
    }

    if (action) {
      notif.status = action;
    }
    notif.read = true;
    await notif.save();

    if (notif.admissionId && action) {
      await Admission.findByIdAndUpdate(notif.admissionId, {
        $set: { discountApprovalStatus: action }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Notification updated successfully`,
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
