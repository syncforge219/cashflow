import mongoose, { Schema } from "mongoose";

const BatchSchema = new Schema(
  {
    batchId: {
      type: String,
      unique: true,
      sparse: true,
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
    courses: [
      {
        type: String,
        trim: true,
      },
    ],
    courseCode: {
      type: String,
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
    brandId: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
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
    // True when Completed / Cancelled was chosen by hand; otherwise status follows the dates
    statusLocked: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      trim: true,
    },
    // Role of the user who created the batch, taken from their session. Roles are free text in this
    // app ("admin", "Super Admin", "director", ...), so this is not restricted to a fixed list; the old
    // list made batch creation fail for admins, managers and directors.
    creatorRole: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
    },
    students: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
    autoIndex: process.env.NODE_ENV !== "production",
  }
);

import { getNextSequence } from "@/lib/sequenceHelper";

// Performance & Compound Indexes
BatchSchema.index({ brandId: 1, status: 1 });
BatchSchema.index({ brandId: 1 });
BatchSchema.index({ brand: 1, status: 1 });
BatchSchema.index({ teacherId: 1, status: 1 });
BatchSchema.index({ brand: 1 });
BatchSchema.index({ teacherId: 1 });
BatchSchema.index({ status: 1 });
BatchSchema.index({ course: 1 });
BatchSchema.index({ courses: 1 });

import { syncBatchRefs } from "@/lib/referenceHelper";

// Atomic Auto-generate batchId using document's transaction session
BatchSchema.pre("save", async function () {
  const session = this.$session();

  // Dual-write synchronization between strings and ObjectIds
  await syncBatchRefs(this, session);

  if (!this.batchId) {
    this.batchId = await getNextSequence(
      "batchId",
      "BAT",
      6,
      async () => {
        const query = mongoose.models.Batch.findOne({
          batchId: /^BAT\d+$/
        }).sort({ batchId: -1 });
        if (session) query.session(session);
        const lastBatch = await query;

        if (lastBatch && lastBatch.batchId) {
          const match = lastBatch.batchId.match(/^BAT(\d+)$/);
          if (match) {
            return parseInt(match[1], 10);
          }
        }
        return 0;
      },
      session
    );
  }
});

BatchSchema.pre(["findOneAndUpdate", "updateOne"], async function () {
  const update = this.getUpdate() as any;
  if (update) {
    const session = this.getOptions()?.session;
    const target = update.$set || update;
    await syncBatchRefs(target, session);
  }
});

if (mongoose.models.Batch) {
  delete mongoose.models.Batch;
}

const Batch = mongoose.model("Batch", BatchSchema);

export default Batch;

