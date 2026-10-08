import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import Task from "@/models/Task";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";

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

    // Check for lead follow-up tasks linked to admitted students/enquiries
    const leadTasks = rawTasks.filter((t: any) =>
      ["Lead Call", "Demo", "Follow-up", "General"].includes(t.taskType) ||
      t.linkedType === "Enquiry" ||
      (t.title && t.title.toLowerCase().startsWith("call lead"))
    );

    const admittedEnqSet = new Set<string>();
    const admittedAdmSet = new Set<string>();
    const admittedStudentNames = new Set<string>();

    if (leadTasks.length > 0) {
      const enqIds = Array.from(new Set(leadTasks.map((t: any) => t.linkedEnquiryId).filter(Boolean)));
      const studentNames = Array.from(new Set(leadTasks.map((t: any) => (t.linkedStudentName || "").trim().toLowerCase()).filter(Boolean)));
      const studentIds = Array.from(new Set(leadTasks.map((t: any) => t.linkedStudentId).filter(Boolean)));

      const validEnqObjectIds = enqIds.filter((id: any) => mongoose.Types.ObjectId.isValid(id)).map((id: any) => new mongoose.Types.ObjectId(id));
      const validStudentObjectIds = studentIds.filter((id: any) => mongoose.Types.ObjectId.isValid(id)).map((id: any) => new mongoose.Types.ObjectId(id));

      const [admittedEnqs, admissionDocs] = await Promise.all([
        Enquiry.find({
          $and: [
            {
              $or: [
                ...(validEnqObjectIds.length > 0 ? [{ _id: { $in: validEnqObjectIds } }] : []),
                ...(enqIds.length > 0 ? [{ enquiryId: { $in: enqIds } }] : []),
                ...(studentNames.length > 0 ? [{ studentFullName: { $in: studentNames.map((n) => new RegExp(`^${n}$`, "i")) } }] : [])
              ]
            },
            {
              $or: [
                { isAdmitted: true },
                { status: { $in: ["Admitted", "Admission", "Converted", "Enrolled"] } }
              ]
            }
          ]
        }).select("_id enquiryId studentFullName").lean(),
        Admission.find({
          $or: [
            ...(enqIds.length > 0 ? [{ enquiryId: { $in: enqIds } }] : []),
            ...(validEnqObjectIds.length > 0 ? [{ _id: { $in: validEnqObjectIds } }] : []),
            ...(validStudentObjectIds.length > 0 ? [{ _id: { $in: validStudentObjectIds } }] : []),
            ...(studentIds.length > 0 ? [{ admissionId: { $in: studentIds } }] : []),
            ...(studentNames.length > 0 ? [{ fullName: { $in: studentNames.map((n) => new RegExp(`^${n}$`, "i")) } }] : []),
            ...(studentNames.length > 0 ? [{ studentFullName: { $in: studentNames.map((n) => new RegExp(`^${n}$`, "i")) } }] : [])
          ]
        }).select("_id admissionId enquiryId fullName studentFullName").lean()
      ]);

      admittedEnqs.forEach((e: any) => {
        if (e._id) admittedEnqSet.add(e._id.toString());
        if (e.enquiryId) admittedEnqSet.add(e.enquiryId);
        if (e.studentFullName) admittedStudentNames.add(e.studentFullName.trim().toLowerCase());
      });

      admissionDocs.forEach((a: any) => {
        if (a._id) admittedAdmSet.add(a._id.toString());
        if (a.admissionId) admittedAdmSet.add(a.admissionId);
        if (a.enquiryId) admittedAdmSet.add(a.enquiryId);
        if (a.fullName) admittedStudentNames.add(a.fullName.trim().toLowerCase());
        if (a.studentFullName) admittedStudentNames.add(a.studentFullName.trim().toLowerCase());
      });
    }

    const tasksToCompleteIds: any[] = [];

    let tasks = rawTasks.map((t: any) => {
      const isLeadTask =
        ["Lead Call", "Demo", "Follow-up", "General"].includes(t.taskType) ||
        t.linkedType === "Enquiry" ||
        (t.title && t.title.toLowerCase().startsWith("call lead"));

      const isLinkedToAdmitted =
        isLeadTask &&
        ((t.linkedEnquiryId && (admittedEnqSet.has(String(t.linkedEnquiryId)) || admittedAdmSet.has(String(t.linkedEnquiryId)))) ||
          (t.linkedStudentId && admittedAdmSet.has(String(t.linkedStudentId))) ||
          (t.linkedStudentName && admittedStudentNames.has((t.linkedStudentName || "").trim().toLowerCase())));

      if (isLinkedToAdmitted && t.status !== "Completed") {
        tasksToCompleteIds.push(t._id);
      }

      const effectiveTaskStatus = isLinkedToAdmitted ? "Completed" : t.status;

      const isOverdue =
        effectiveTaskStatus === "Overdue" ||
        ((effectiveTaskStatus === "Pending" || effectiveTaskStatus === "In Progress") && t.dueDate && new Date(t.dueDate) < now);

      return {
        ...t,
        status: isOverdue ? "Overdue" : effectiveTaskStatus,
        isOverdue: Boolean(isOverdue),
        isAdmittedStudent: Boolean(isLinkedToAdmitted),
      };
    });

    if (tasksToCompleteIds.length > 0) {
      await Task.updateMany(
        { _id: { $in: tasksToCompleteIds } },
        { $set: { status: "Completed", completedAt: new Date() } }
      );
    }

    if (status && status !== "All") {
      tasks = tasks.filter((t) => t.status === status);
    }

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
