import mongoose, { Schema, Document } from "mongoose";
import { auditContextPlugin } from "@/lib/auditContextPlugin";
import { softDeletePlugin } from "@/lib/softDeletePlugin";
import { getNextSequence } from "@/lib/sequenceHelper";
import { normalizePhone } from "@/lib/studentHelper";

export interface IStudent extends Document {
  studentCode: string;
  fullName: string;
  primaryPhone: string;
  alternatePhone?: string;
  email?: string;
  parentName?: string;
  parentPhone?: string;
  guardian2Name?: string;
  guardian2Phone?: string;
  city?: string;
  address?: string;
  state?: string;
  pincode?: string;
  dob?: string;
  gender?: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
}

const StudentSchema = new Schema<IStudent>(
  {
    studentCode: {
      type: String,
      unique: true,
      trim: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    primaryPhone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    alternatePhone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    parentName: {
      type: String,
      trim: true,
      default: "",
    },
    parentPhone: {
      type: String,
      trim: true,
      default: "",
    },
    guardian2Name: {
      type: String,
      trim: true,
      default: "",
    },
    guardian2Phone: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    state: {
      type: String,
      trim: true,
      default: "",
    },
    pincode: {
      type: String,
      trim: true,
      default: "",
    },
    dob: {
      type: String,
      trim: true,
      default: "",
    },
    gender: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "ARCHIVED"],
      default: "ACTIVE",
      index: true,
    },
  },
  { timestamps: true }
);

// Compound Indexes for fast duplicate scanning & search
StudentSchema.index({ primaryPhone: 1, isDeleted: 1 });
StudentSchema.index({ email: 1, isDeleted: 1 });
StudentSchema.index({ fullName: "text", city: "text" });

// Automatically assign sequential studentCode if not present
StudentSchema.pre("save", async function () {
  if (this.isNew && !this.studentCode) {
    const session = typeof this.$session === "function" ? this.$session() : null;
    this.studentCode = await getNextSequence(
      "studentCode",
      "STU",
      6,
      async () => {
        const last = await (this.constructor as any)
          .findOne({ studentCode: /^STU\d+$/ })
          .sort({ studentCode: -1 })
          .select("studentCode")
          .lean();
        if (last && last.studentCode) {
          const num = parseInt(last.studentCode.replace(/^STU/, ""), 10);
          return isNaN(num) ? 0 : num;
        }
        return 0;
      },
      session
    );
  }
});

// Normalize phone numbers on pre-save
StudentSchema.pre("save", function () {
  if (this.primaryPhone) {
    this.primaryPhone = normalizePhone(this.primaryPhone);
  }
  if (this.parentPhone) {
    this.parentPhone = normalizePhone(this.parentPhone);
  }
  if (this.guardian2Phone) {
    this.guardian2Phone = normalizePhone(this.guardian2Phone);
  }
});

// Apply auditContextPlugin and softDeletePlugin
StudentSchema.plugin(auditContextPlugin);
StudentSchema.plugin(softDeletePlugin);

if (mongoose.models.Student) {
  delete mongoose.models.Student;
}

const Student = mongoose.model<IStudent>("Student", StudentSchema);
export default Student;
