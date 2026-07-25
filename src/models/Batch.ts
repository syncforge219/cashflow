import mongoose, { Schema } from "mongoose";

const BatchSchema = new Schema(
  {
    batchName: {
      type: String,
      required: [true, "Batch name is required"],
      trim: true,
    },
    course: {
      type: String,
      required: [true, "Course name is required"],
      trim: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Assigned faculty / teacher is required"],
    },
    teacherName: {
      type: String,
      required: [true, "Faculty name is required"],
      trim: true,
    },
    brand: {
      type: String,
      required: [true, "Brand scope is required"],
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
    },
    timing: {
      type: String,
      required: [true, "Timing is required"],
      trim: true,
    },
    days: [
      {
        type: String,
        trim: true,
      },
    ],
    maxCapacity: {
      type: Number,
      default: 30,
    },
    enrolledCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Upcoming", "Active", "Completed", "Cancelled"],
      default: "Upcoming",
    },
    createdBy: {
      type: String,
      trim: true,
    },
    creatorRole: {
      type: String,
      enum: ["super admin", "brand manager", "centre head", "counsellor", "sales executive", "teacher", "system"],
      default: "super admin",
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

// Performance Indexes
BatchSchema.index({ brand: 1 });
BatchSchema.index({ teacherId: 1 });
BatchSchema.index({ status: 1 });
BatchSchema.index({ course: 1 });

const Batch = mongoose.models.Batch || mongoose.model("Batch", BatchSchema);

export default Batch;
