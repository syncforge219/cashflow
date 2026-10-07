import { todayKey, toDateKey, addDaysKey } from "@/lib/dates";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Notification from "@/models/Notification";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();

    // Session tokens are opaque (not JWTs), so look the user up via the session.
    const sessionUser = await getAuthenticatedUser();
    const userName = sessionUser?.name || "System";

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
      leadType,
    } = body;

    const newFollowup: any = {
      date: toDateKey(date) || todayKey(),
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

      const nextDateStr = addDaysKey(newFollowup.date, daysToAdd);

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

    // Enquiry-level fields go in an explicit $set so the model's pre-update hook can
    // re-resolve assignedCrmAdvisorId from the new advisor name.
    const setFields: any = {};
    if (assignedTo) {
      setFields.assignedCrmAdvisor = assignedTo;
    }
    if (priority) {
      setFields.priorityLevel = priority;
    }
    if (typeof leadType === "string" && leadType.trim()) {
      setFields.leadType = leadType.trim();
    }
    if (Array.isArray(selectedCourses)) {
      const coursesList = selectedCourses.map((c: any) => String(c).trim()).filter(Boolean);
      if (coursesList.length > 0) {
        // Keep all three course fields in step, as POST/PATCH /api/enquiries do
        setFields.courses = coursesList;
        setFields.targetCourses = coursesList;
        setFields.targetCourse = coursesList.join(", ");
        setFields.isLookingForJob = coursesList.length === 1 && coursesList[0] === "Looking for Job";
      }
    }

    const updateQuery: any = {
      $push: {
        followUps: { $each: pushItems },
      },
    };
    if (Object.keys(setFields).length > 0) {
      updateQuery.$set = setFields;
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
      item.completedAt = targetCompleted ? item.completedAt || new Date() : undefined;

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
        if (targetCompleted) {
          // Close only the open follow-ups; history (completed/cancelled) keeps its own status and completedAt
          enquiry.followUps.forEach((item: any) => {
            const s = (item.status || "").toLowerCase();
            if (item.isCompleted || s === "completed" || s === "cancelled") return;
            item.status = targetStatus;
            item.isCompleted = true;
            item.completedAt = new Date();
          });
        } else {
          // Re-opening: only the most recent follow-up goes back to pending, not the whole history
          const latest: any = enquiry.followUps[enquiry.followUps.length - 1];
          latest.status = targetStatus;
          latest.isCompleted = false;
          latest.completedAt = undefined;
        }
      } else {
        enquiry.followUps.push({
          date: enquiry.followUpDate || enquiry.date || todayKey(),
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

    if (assignedTo && assignedTo !== enquiry.assignedCrmAdvisor) {
      enquiry.assignedCrmAdvisor = assignedTo;
      // Drop the old advisor's id so the pre-save hook re-resolves it from the new name;
      // otherwise the lead stays linked to (and visible for) the previous advisor.
      (enquiry as any).assignedCrmAdvisorId = undefined;
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
