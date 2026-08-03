import mongoose, { Schema } from "mongoose";

const StaffAttendanceSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    userName: {
      type: String,
      required: [true, "Staff name is required"],
      trim: true,
    },
    userEmail: {
      type: String,
      required: [true, "Staff email is required"],
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
      default: "",
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
    },
    dateStr: {
      type: String, // YYYY-MM-DD for fast querying
      required: true,
    },
    checkInTime: {
      type: String, // e.g. "09:30 AM"
      required: true,
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Late"],
      default: "Present",
    },
    locationVerified: {
      type: Boolean,
      default: true,
    },
    faceVerified: {
      type: Boolean,
      default: true,
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    distanceMeters: {
      type: Number,
    },
    confidence: {
      type: Number, // Face match similarity score (0 to 100%)
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index to prevent duplicate staff attendance logs for same user on same date
StaffAttendanceSchema.index({ userId: 1, dateStr: 1 }, { unique: true });
StaffAttendanceSchema.index({ dateStr: 1 });
StaffAttendanceSchema.index({ role: 1 });
StaffAttendanceSchema.index({ brand: 1 });

if (mongoose.models && mongoose.models.StaffAttendance) {
  delete (mongoose.models as any).StaffAttendance;
}

const StaffAttendance = mongoose.model("StaffAttendance", StaffAttendanceSchema);

export default StaffAttendance;
