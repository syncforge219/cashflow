import mongoose, { Schema } from "mongoose";

const CourseSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Course Name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Course Code is required"],
      unique: true,
      trim: true,
    },
    brand: {
      type: String,
      required: [true, "Brand is required"],
      trim: true,
    },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    duration: {
      type: String,
      required: [true, "Duration is required"],
      trim: true,
    },
    fee: {
      type: String,
      required: [true, "Fee is required"],
      trim: true,
    },
    status: {
      type: String,
      default: "ACTIVE",
      enum: ["ACTIVE", "INACTIVE"],
    },
    maxDiscountLimit: {
      type: Number,
      default: 5000,
    },
    batches: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

import { syncCourseRefs } from "@/lib/referenceHelper";

CourseSchema.index({ brandId: 1, status: 1 });
CourseSchema.index({ brandId: 1 });

CourseSchema.pre("save", async function () {
  const session = this.$session?.();
  await syncCourseRefs(this, session);
});

CourseSchema.pre(["findOneAndUpdate", "updateOne"], async function () {
  const update = this.getUpdate() as any;
  if (update) {
    const session = this.getOptions()?.session;
    const target = update.$set || update;
    await syncCourseRefs(target, session);
  }
});

if (mongoose.models.Course) {
  delete mongoose.models.Course;
}
const Course = mongoose.model("Course", CourseSchema);

export default Course;

