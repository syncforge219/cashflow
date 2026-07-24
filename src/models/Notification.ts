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
      enum: ["discount_approval", "task_escalation", "general"],
      default: "discount_approval",
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
      default: "Counsellor",
      trim: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
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
