import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Notification from "@/models/Notification";
import { verifyJWT } from "@/lib/jwt";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    let userName = "System";

    if (token) {
      try {
        const decoded = await verifyJWT(token);
        if (decoded && decoded.name) {
          userName = decoded.name;
        }
      } catch (err) {
        console.error("JWT verification failed in tasks route:", err);
      }
    }

    const {
      date,
      time,
      priority = "Medium",
      typeOfContact = "Telephonic",
      remarks = "",
      nextAction = "",
      assignedTo,
      status = "Pending",
      isRecurring = false,
      recurringRule = "none",
      callStart,
      callEnd,
      selectedCourses,
    } = body;

    const newFollowup: any = {
      date: date || new Date().toISOString().split("T")[0],
      time: time || "11:00 AM",
      priority,
      typeOfContact,
      remarks,
      nextAction,
      assignedTo: assignedTo || undefined,
      status,
      plannedBy: userName,
      isCompleted: status === "Completed",
      completedAt: status === "Completed" ? new Date() : undefined,
      isRecurring: Boolean(isRecurring || (recurringRule && recurringRule !== "none")),
      recurringRule: recurringRule || "none",
      callStart,
      callEnd,
      createdAt: new Date(),
    };

    const pushItems = [newFollowup];

    // Feature 5: Recurring Follow-ups Auto-Schedule Logic
    if (recurringRule && recurringRule !== "none") {
      let daysToAdd = 3;
      if (recurringRule === "1_day") daysToAdd = 1;
      else if (recurringRule === "3_days") daysToAdd = 3;
      else if (recurringRule === "7_days") daysToAdd = 7;
      else if (recurringRule === "14_days") daysToAdd = 14;
      else if (recurringRule === "30_days") daysToAdd = 30;

      const baseDate = new Date(newFollowup.date);
      baseDate.setDate(baseDate.getDate() + daysToAdd);
      const nextDateStr = baseDate.toISOString().split("T")[0];

      pushItems.push({
        date: nextDateStr,
        time: time || "11:00 AM",
        priority,
        typeOfContact,
        remarks: `[Auto-Generated Recurring Follow-up] Next touchpoint scheduled for ${nextDateStr}`,
        nextAction: `Follow-up with lead on scheduled interval (+${daysToAdd} days)`,
        assignedTo: assignedTo || undefined,
        status: "Pending",
        plannedBy: "System (Recurring Engine)",
        isCompleted: false,
        isRecurring: true,
        recurringRule,
        createdAt: new Date(),
      });
    }

    const updateQuery: any = {
      $push: {
        followUps: { $each: pushItems },
      },
    };

    if (assignedTo) {
      updateQuery.assignedCrmAdvisor = assignedTo;
    }
    if (priority) {
      updateQuery.priorityLevel = priority;
    }
    if (selectedCourses && Array.isArray(selectedCourses) && selectedCourses.length > 0) {
      updateQuery.courses = selectedCourses;
    }

    const updatedEnquiry = await Enquiry.findByIdAndUpdate(id, updateQuery, {
      returnDocument: "after",
      runValidators: true,
    });

    if (!updatedEnquiry) {
      return NextResponse.json(
        { success: false, message: "Enquiry not found" },
        { status: 404 }
      );
    }

    // Send in-app notification if assigned to a specific advisor
    if (assignedTo && assignedTo !== userName) {
      try {
        await Notification.create({
          recipient: assignedTo,
          title: "📌 New Follow-up Assigned",
          message: `You have been assigned a follow-up for student ${updatedEnquiry.studentFullName || "Lead"} scheduled on ${newFollowup.date}. Priority: ${priority}.`,
          type: "task",
          link: "/followups",
        });
      } catch (e) {
        console.error("Failed to create assignment notification:", e);
      }
    }

    return NextResponse.json(
      { success: true, data: updatedEnquiry, message: "Follow-up logged successfully" },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error adding task:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to add task" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    const { followupIndex, status, isCompleted, remarks, priority, assignedTo, escalatedToManager } = body;

    const enquiry = await Enquiry.findById(id);
    if (!enquiry) {
      return NextResponse.json({ success: false, message: "Enquiry not found" }, { status: 404 });
    }

    if (typeof followupIndex === "number" && enquiry.followUps && enquiry.followUps[followupIndex]) {
      const item = enquiry.followUps[followupIndex];
      const targetCompleted = typeof isCompleted === "boolean" ? isCompleted : (status === "Completed");
      const targetStatus = status || (targetCompleted ? "Completed" : "Pending");
      item.status = targetStatus;
      item.isCompleted = targetCompleted;
      if (targetCompleted) {
        item.completedAt = new Date();
      }

      if (remarks !== undefined) item.remarks = remarks;
      if (priority) item.priority = priority;
      if (assignedTo) item.assignedTo = assignedTo;

      if (escalatedToManager !== undefined) {
        item.escalatedToManager = Boolean(escalatedToManager);
        if (escalatedToManager) {
          item.escalatedAt = new Date();
        }
      }
    } else {
      // General update to active/all followups
      const targetCompleted = typeof isCompleted === "boolean" ? isCompleted : (status === "Completed");
      const targetStatus = status || (targetCompleted ? "Completed" : "Pending");

      if (enquiry.followUps && enquiry.followUps.length > 0) {
        enquiry.followUps.forEach((item: any) => {
          item.status = targetStatus;
          item.isCompleted = targetCompleted;
          if (targetCompleted) {
            item.completedAt = new Date();
          }
        });
      } else {
        enquiry.followUps.push({
          date: enquiry.followUpDate || enquiry.date || new Date().toISOString().split("T")[0],
          time: "10:00",
          priority: priority || enquiry.priorityLevel || "Medium",
          typeOfContact: "Phone Call",
          remarks: remarks || enquiry.followUpNotes || enquiry.remarks || "Follow-up completed",
          nextAction: "",
          status: targetStatus,
          plannedBy: enquiry.assignedCrmAdvisor || "System",
          assignedTo: enquiry.assignedCrmAdvisor || "Unassigned",
          isCompleted: targetCompleted,
          completedAt: targetCompleted ? new Date() : undefined,
          isRecurring: false,
          recurringRule: "none",
          escalatedToManager: false,
          createdAt: new Date(),
        } as any);
      }
    }

    if (assignedTo) {
      enquiry.assignedCrmAdvisor = assignedTo;
    }
    if (priority) {
      enquiry.priorityLevel = priority;
    }

    await enquiry.save();

    return NextResponse.json({ success: true, data: enquiry, message: "Follow-up updated successfully" });
  } catch (error: any) {
    console.error("Error updating followup task:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to update followup" }, { status: 500 });
  }
}
