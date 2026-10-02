import mongoose, { Schema } from "mongoose";

const TaskSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    taskType: {
      type: String,
      enum: [
        "Lead Call",
        "Demo",
        "Document Collection",
        "Fee Collection",
        "Batch Allocation",
        "Welcome Onboarding",
        "EMI Recovery",
        "Fee Follow-up",
        "Fee Followup",
        "Follow-up",
        "General"
      ],
      default: "General",
    },
    linkedType: {
      type: String,
      enum: ["Enquiry", "Admission"],
      index: true,
    },
    linkedStudentId: {
      type: String,
      trim: true,
    },
    linkedStudentName: {
      type: String,
      trim: true,
    },
    linkedEnquiryId: {
      type: String,
      trim: true,
    },
    assignedTo: {
      type: String,
      required: [true, "Assigned user/counsellor is required"],
      trim: true,
    },
    assignedRole: {
      type: String,
      default: "counsellor",
    },
    createdBy: {
      type: String,
      default: "System Engine",
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent / Escalated"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Completed", "Overdue", "Escalated"],
      default: "Pending",
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required"],
    },
    checklist: [
      {
        text: { type: String, required: true },
        isCompleted: { type: Boolean, default: false },
      },
    ],
    comments: [
      {
        author: { type: String, required: true },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isEscalated: {
      type: Boolean,
      default: false,
    },
    escalatedToManager: {
      type: String,
      trim: true,
    },
    autoTriggerSource: {
      type: String,
      trim: true,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    autoIndex: process.env.NODE_ENV !== "production",
  }
);

// Performance & Compound Indexes
TaskSchema.index({ linkedType: 1, status: 1 });
TaskSchema.index({ linkedStudentId: 1 });
TaskSchema.index({ status: 1, dueDate: 1 });
TaskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
TaskSchema.index({ assignedTo: 1, dueDate: 1 });
TaskSchema.index({ assignedTo: 1 });
TaskSchema.index({ dueDate: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ createdAt: -1 });

// Auto-infer linkedType if not provided
TaskSchema.pre("save", function () {
  if (!this.linkedType) {
    const sId = (this.linkedStudentId || "").trim().toUpperCase();
    const eId = (this.linkedEnquiryId || "").trim().toUpperCase();
    if (sId.startsWith("ADM")) {
      this.linkedType = "Admission";
    } else if (sId.startsWith("ENQ") || eId.startsWith("ENQ") || eId) {
      this.linkedType = "Enquiry";
    } else if (
      [
        "Document Collection",
        "Fee Collection",
        "Batch Allocation",
        "Welcome Onboarding",
        "EMI Recovery",
        "Fee Follow-up",
        "Fee Followup",
      ].includes(this.taskType)
    ) {
      this.linkedType = "Admission";
    } else if (["Lead Call", "Demo", "Follow-up"].includes(this.taskType)) {
      this.linkedType = "Enquiry";
    }
  }
});

// Prevent mongoose model re-compilation error in Next.js development hot-reloads
if (mongoose.models.Task) {
  delete mongoose.models.Task;
}
const Task = mongoose.model("Task", TaskSchema);

export default Task;
