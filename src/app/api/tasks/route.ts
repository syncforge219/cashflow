import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);

    const assignedTo = searchParams.get("assignedTo");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const isEscalated = searchParams.get("isEscalated");
    const search = searchParams.get("search");

    const query: any = {};

    if (assignedTo) {
      query.assignedTo = { $regex: new RegExp(assignedTo, "i") };
    }

    const now = new Date();

    if (status && status !== "All") {
      if (status === "Overdue") {
        query.$or = [
          { status: "Overdue" },
          { status: { $in: ["Pending", "In Progress"] }, dueDate: { $lt: now } }
        ];
      } else {
        query.status = status;
      }
    }

    if (priority && priority !== "All") {
      query.priority = priority;
    }

    if (isEscalated === "true") {
      query.isEscalated = true;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { linkedStudentName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    // Derive overdue status dynamically at query time without database mutations
    const rawTasks = await Task.find(query).sort({ dueDate: 1, createdAt: -1 }).lean();

    const tasks = rawTasks.map((t: any) => {
      const isOverdue =
        t.status === "Overdue" ||
        ((t.status === "Pending" || t.status === "In Progress") && t.dueDate && new Date(t.dueDate) < now);

      return {
        ...t,
        status: isOverdue ? "Overdue" : t.status,
        isOverdue: Boolean(isOverdue),
      };
    });

    return NextResponse.json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (error: any) {
    console.error("Fetch Tasks API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch tasks." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();

    const {
      title,
      description,
      taskType = "General",
      linkedStudentName,
      linkedStudentId,
      linkedEnquiryId,
      linkedType,
      assignedTo,
      assignedRole = "counsellor",
      priority = "Medium",
      dueDate,
      checklist = []
    } = body;

    if (!title || !assignedTo || !dueDate) {
      return NextResponse.json(
        { success: false, error: "Title, assignedTo, and dueDate are required." },
        { status: 400 }
      );
    }

    const newTask = await Task.create({
      title,
      description,
      taskType,
      linkedType,
      linkedStudentName,
      linkedStudentId,
      linkedEnquiryId,
      assignedTo,
      assignedRole,
      priority,
      status: "Pending",
      dueDate: new Date(dueDate),
      checklist: checklist.map((item: any) => ({
        text: typeof item === "string" ? item : item.text,
        isCompleted: false
      }))
    });

    return NextResponse.json({
      success: true,
      message: "Task created successfully.",
      task: newTask
    }, { status: 201 });
  } catch (error: any) {
    console.error("Create Task API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create task." },
      { status: 500 }
    );
  }
}
