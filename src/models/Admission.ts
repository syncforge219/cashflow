import mongoose, { Schema } from "mongoose";

const AdmissionSchema = new Schema(
  {
    admissionId: {
      type: String,
      unique: true,
    },
    enquiryId: {
      type: Schema.Types.ObjectId,
      ref: "Enquiry",
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
    brand: { type: String },
    isUpgrade: { type: Boolean, default: false },

    // 2. Course Details
    course: { type: String },
    courses: [{ type: String, trim: true }],
    targetCourses: [{ type: String, trim: true }],
    batch: { type: String },
    duration: { type: String },
    startDate: { type: Date },
    academicYear: { type: String },
    admissionDate: { type: Date },
    companyAssigned: { type: String },

    // 3. Discount & Scholarship
    courseFee: { type: Number, default: 0 },
    scholarshipType: { type: String },
    scholarshipAmount: { type: Number, default: 0 },
    discountType: { type: String },
    discountAmount: { type: Number, default: 0 },
    additionalDiscount: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    finalFee: { type: Number, default: 0 },
    discountApprovalStatus: {
      type: String,
      enum: ["Approved", "Pending Approval", "Rejected"],
      default: "Approved",
    },
    maxDiscountLimitAtAdmission: { type: Number, default: 0 },

    // 4. Payment & EMI
    paymentMode: { type: String },
    transactionNo: { type: String },
    amountReceivedToday: { type: Number, default: 0 },
    registrationAmount: { type: Number, default: 0 },
    downpaymentAmount: { type: Number, default: 0 },
    downpaymentDueDate: { type: Date },
    paymentDate: { type: Date },
    remainingBalance: { type: Number, default: 0 },
    hasEmi: { type: Boolean, default: false },
    numInstallments: { type: Number, default: 1 },
    installmentAmount: { type: Number, default: 0 },
    customEmiPlan: [{
      dueDate: { type: Date },
      amount: { type: Number },
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
    feeFollowups: [{
      status: { type: String },
      ptpDate: { type: Date },
      ptpAmount: { type: Number },
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
  }
);

// Performance Indexes
AdmissionSchema.index({ counsellor: 1 });
AdmissionSchema.index({ brand: 1 });
AdmissionSchema.index({ createdAt: -1 });
AdmissionSchema.index({ mobileNumber: 1 });

// Auto-generate admissionId
AdmissionSchema.pre("save", async function () {
  if (!this.admissionId) {
    const lastAdmission = await mongoose.models.Admission.findOne({
      admissionId: /^ADM\d+$/
    }).sort({ admissionId: -1 });

    let nextNumber = 1;
    if (lastAdmission && lastAdmission.admissionId) {
      const match = lastAdmission.admissionId.match(/^ADM(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    this.admissionId = `ADM${String(nextNumber).padStart(6, "0")}`;
  }
});

// Clear the mongoose model if it already exists to fix Next.js HMR caching old hooks
if (mongoose.models.Admission) {
  delete mongoose.models.Admission;
}
const Admission = mongoose.model("Admission", AdmissionSchema);

export default Admission;
