import mongoose, { Schema } from "mongoose";

const StudentAttendanceRecordSchema = new Schema(
  {
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    admissionId: {
      type: String,
      trim: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Late", "Excused"],
      default: "Present",
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const AttendanceSchema = new Schema(
  {
    batchId: {
      type: Schema.Types.ObjectId,
      ref: "Batch",
      required: [true, "Batch is required"],
    },
    batchName: {
      type: String,
      required: [true, "Batch name is required"],
      trim: true,
    },
    course: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
    },
    dateStr: {
      type: String, // YYYY-MM-DD for fast querying
      required: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    teacherName: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    records: [StudentAttendanceRecordSchema],
    totalStudents: {
      type: Number,
      default: 0,
    },
    totalPresent: {
      type: Number,
      default: 0,
    },
    totalAbsent: {
      type: Number,
      default: 0,
    },
    totalLate: {
      type: Number,
      default: 0,
    },
    totalExcused: {
      type: Number,
      default: 0,
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

// Compound Index to prevent duplicate attendance logs for same batch on same date
AttendanceSchema.index({ batchId: 1, dateStr: 1 }, { unique: true });
AttendanceSchema.index({ teacherId: 1 });
AttendanceSchema.index({ brand: 1 });
AttendanceSchema.index({ dateStr: 1 });

const Attendance =
  mongoose.models.Attendance || mongoose.model("Attendance", AttendanceSchema);

export default Attendance;
