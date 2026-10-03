import mongoose, { Schema } from "mongoose";
import { softDeletePlugin } from "@/lib/softDeletePlugin";

function safeObjectIdCast(v: any) {
  if (!v || v === "" || v === "Unassigned" || v === "General Batch" || v === "undefined" || v === "null") {
    return null;
  }
  if (v instanceof mongoose.Types.ObjectId) return v;
  if (typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v)) {
    return new mongoose.Types.ObjectId(v);
  }
  return null;
}

const AdmissionSchema = new Schema(
  {
    admissionId: {
      type: String,
      unique: true,
    },
    enquiryId: {
      type: Schema.Types.ObjectId,
      ref: "Enquiry",
      default: null,
      cast: safeObjectIdCast,
      set: safeObjectIdCast,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      index: true,
      default: null,
      cast: safeObjectIdCast,
      set: safeObjectIdCast,
    },
    // 1. Student Information
    fullName: { type: String },
    mobileNumber: { type: String },
    primaryPhoneMobile: { type: String },
    email: { type: String },
    parentName: { type: String },
    parentPhone: { type: String },
    parentsFullName: { type: String },
    parentsPhoneNumber: { type: String },
    guardian2Name: { type: String },
    guardian2Phone: { type: String },
    guardian2Relation: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    dob: { type: String },
    gender: { type: String },
    counsellor: { type: String },
    counsellorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      cast: safeObjectIdCast,
      set: safeObjectIdCast,
    },
    brand: { type: String },
    brandId: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
      cast: safeObjectIdCast,
      set: safeObjectIdCast,
    },
    isUpgrade: { type: Boolean, default: false },

    // 2. Course Details
    course: { type: String },
    courses: [{ type: String, trim: true }],
    targetCourses: [{ type: String, trim: true }],
    batch: { type: String },
    batchId: {
      type: Schema.Types.Mixed,
      ref: "Batch",
      index: true,
      default: null,
    },
    duration: { type: String },
    startDate: { type: Date },
    academicYear: { type: String },
    admissionDate: { type: Date },
    companyAssigned: { type: String },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      cast: safeObjectIdCast,
      set: safeObjectIdCast,
    },

    // 3. Discount & Scholarship
    courseFee: { type: Number, default: 0 },
    courseFeePaise: { type: Number, default: 0 },
    scholarshipType: { type: String },
    scholarshipAmount: { type: Number, default: 0 },
    scholarshipAmountPaise: { type: Number, default: 0 },
    discountType: { type: String },
    discountAmount: { type: Number, default: 0 },
    discountAmountPaise: { type: Number, default: 0 },
    additionalDiscount: { type: Number, default: 0 },
    additionalDiscountPaise: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    totalDiscountPaise: { type: Number, default: 0 },
    finalFee: { type: Number, default: 0 },
    finalFeePaise: { type: Number, default: 0 },
    discountApprovalStatus: {
      type: String,
      enum: ["Approved", "Pending Approval", "Rejected"],
      default: "Approved",
    },
    maxDiscountLimitAtAdmission: { type: Number, default: 0 },
    maxDiscountLimitAtAdmissionPaise: { type: Number, default: 0 },

    // 4. Payment & EMI
    paymentMode: { type: String },
    transactionNo: { type: String },
    amountReceivedToday: { type: Number, default: 0 },
    amountReceivedTodayPaise: { type: Number, default: 0 },
    registrationAmount: { type: Number, default: 0 },
    registrationAmountPaise: { type: Number, default: 0 },
    downpaymentAmount: { type: Number, default: 0 },
    downpaymentAmountPaise: { type: Number, default: 0 },
    downpaymentDueDate: { type: Date },
    paymentDate: { type: Date },
    remainingBalance: { type: Number, default: 0 },
    remainingBalancePaise: { type: Number, default: 0 },
    hasEmi: { type: Boolean, default: false },
    numInstallments: { type: Number, default: 1 },
    installmentAmount: { type: Number, default: 0 },
    installmentAmountPaise: { type: Number, default: 0 },
    customEmiPlan: [{
      dueDate: { type: Date },
      amount: { type: Number },
      amountPaise: { type: Number },
      isPaid: { type: Boolean, default: false },
      paidDate: { type: Date },
      reminderSentAt: { type: Date },
      lastReminderStatus: { type: String }
    }],
    lastEmiReminderSentAt: { type: Date },
    lastFollowupDate: { type: Date },
    lastFollowupNotes: { type: String },
    nextFollowupDate: { type: Date },
    ptpDate: { type: Date },
    ptpAmount: { type: Number },
    ptpAmountPaise: { type: Number },
    feeFollowups: [{
      status: { type: String },
      ptpDate: { type: Date },
      ptpAmount: { type: Number },
      ptpAmountPaise: { type: Number },
      expectedPaymentMode: { type: String },
      nextFollowupDate: { type: Date },
      nextFollowupTime: { type: String },
      priority: { type: String },
      remarks: { type: String },
      assignedTo: { type: String },
      createdAt: { type: Date, default: Date.now }
    }],
  },
  {
    timestamps: true,
    autoIndex: process.env.NODE_ENV !== "production",
  }
);

import { getNextSequence } from "@/lib/sequenceHelper";

// Unique partial index on enquiryId where enquiryId exists
AdmissionSchema.index(
  { enquiryId: 1 },
  {
    unique: true,
    partialFilterExpression: { enquiryId: { $exists: true, $type: "objectId" } },
  }
);

// Performance & Compound Indexes
AdmissionSchema.index({ brandId: 1, createdAt: -1 });
AdmissionSchema.index({ brandId: 1, admissionDate: -1 });
AdmissionSchema.index({ counsellorId: 1, createdAt: -1 });
AdmissionSchema.index({ companyId: 1, admissionDate: -1 });
AdmissionSchema.index({ brand: 1, createdAt: -1 });
AdmissionSchema.index({ brand: 1, admissionDate: -1 });
AdmissionSchema.index({ counsellor: 1, createdAt: -1 });
AdmissionSchema.index({ batchId: 1, createdAt: -1 });
AdmissionSchema.index({ admissionDate: -1 });
AdmissionSchema.index({ mobileNumber: 1 });
AdmissionSchema.index({ brandId: 1 });
AdmissionSchema.index({ companyId: 1 });
AdmissionSchema.index({ counsellorId: 1 });

import { syncAdmissionRefs } from "@/lib/referenceHelper";
import { syncAdmissionMoney } from "@/lib/moneySyncHelper";
import { resolveStudentForAdmission } from "@/lib/studentHelper";

// Sanitize legacy/empty string ObjectIds and sync references BEFORE validation runs
AdmissionSchema.pre("validate", async function () {
  const session = this.$session();

  // Clear any transient casting errors that Mongoose doc.init() might have logged on these fields
  if (this.errors) {
    delete (this.errors as any).batchId;
    delete (this.errors as any).brandId;
    delete (this.errors as any).companyId;
    delete (this.errors as any).counsellorId;
    delete (this.errors as any).enquiryId;
    delete (this.errors as any).studentId;
  }

  if (!this.batchId || (this.batchId as any) === "" || (this.batchId as any) === "Unassigned" || (this.batchId as any) === "General Batch") {
    this.batchId = null;
  }
  if (!this.brandId || (this.brandId as any) === "") this.brandId = null;
  if (!this.companyId || (this.companyId as any) === "") this.companyId = null;
  if (!this.counsellorId || (this.counsellorId as any) === "") this.counsellorId = null;
  if (!this.enquiryId || (this.enquiryId as any) === "") this.enquiryId = null;
  if (!this.studentId || (this.studentId as any) === "") this.studentId = null;

  // Dual-write synchronization between strings and ObjectIds before validation
  await syncAdmissionRefs(this, session);

  // Dual-write synchronization between rupees and integer paise
  syncAdmissionMoney(this);
});

// Dual-write sync and atomic Auto-generate admissionId using the document's transaction session
AdmissionSchema.pre("save", async function () {
  const session = this.$session();

  if (this.isNew && !this.studentId) {
    this.studentId = await resolveStudentForAdmission(this, session);
  }

  if (!this.admissionId) {
    this.admissionId = await getNextSequence(
      "admissionId",
      "ADM",
      6,
      async () => {
        const query = mongoose.models.Admission.findOne({
          admissionId: /^ADM\d+$/
        }).sort({ admissionId: -1 });
        if (session) query.session(session);
        const lastAdmission = await query;

        if (lastAdmission && lastAdmission.admissionId) {
          const match = lastAdmission.admissionId.match(/^ADM(\d+)$/);
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

AdmissionSchema.pre(["findOneAndUpdate", "updateOne", "updateMany"], async function () {
  const update = this.getUpdate() as any;
  if (update) {
    const session = this.getOptions()?.session;
    const target = update.$set || update;
    if (target.batchId === "" || target.batchId === "Unassigned" || target.batchId === "General Batch") {
      target.batchId = null;
    }
    if (target.brandId === "") target.brandId = null;
    if (target.companyId === "") target.companyId = null;
    if (target.counsellorId === "") target.counsellorId = null;
    if (target.enquiryId === "") target.enquiryId = null;
    if (target.studentId === "") target.studentId = null;

    await syncAdmissionRefs(target, session);
    syncAdmissionMoney(target);
  }
});

AdmissionSchema.plugin(softDeletePlugin);

// Clear the mongoose model if it already exists to fix Next.js HMR caching old hooks
if (mongoose.models.Admission) {
  delete mongoose.models.Admission;
}
const Admission = mongoose.model("Admission", AdmissionSchema);

export default Admission;

