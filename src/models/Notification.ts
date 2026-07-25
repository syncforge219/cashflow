import mongoose, { Schema } from "mongoose";

const NotificationSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["discount_approval", "task_escalation", "demo_scheduled", "attendance_reminder", "student_enrolled", "general"],
      default: "general",
    },
    targetRole: {
      type: String,
      enum: ["teacher", "counsellor", "sales executive", "admin", "brand manager", "centre head", "all"],
      default: "all",
    },
    targetTeacherId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    admissionId: {
      type: String,
      trim: true,
    },
    studentFullName: {
      type: String,
      trim: true,
    },
    courseName: {
      type: String,
      trim: true,
    },
    requestedDiscount: {
      type: Number,
      default: 0,
    },
    maxAllowedDiscount: {
      type: Number,
      default: 0,
    },
    requestedBy: {
      type: String,
      default: "System",
      trim: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Unread", "Read"],
      default: "Unread",
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);

export default Notification;
