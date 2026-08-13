import mongoose, { Schema } from "mongoose";

const CorporatePaymentRecordSchema = new Schema(
  {
    receiptNo: { type: String },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    paymentMode: { type: String, default: "Bank Transfer / NEFT" },
    referenceNo: { type: String },
    remarks: { type: String },
    recordedBy: { type: String },
  },
  { _id: true, timestamps: true }
);

const CorporateTrainingSchema = new Schema(
  {
    trainingId: {
      type: String,
      unique: true,
      index: true,
    },
    // 1. Client / Organization Details
    companyName: {
      type: String,
      required: [true, "Client organization name is required"],
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // 2. Training Program Details
    trainingProgram: {
      type: String,
      required: [true, "Training program or course title is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    trainingMode: {
      type: String,
      enum: ["Offline (Client Site)", "Offline (Centre / Campus)", "Online Live Virtual", "Hybrid"],
      default: "Offline (Client Site)",
    },
    numberOfParticipants: {
      type: Number,
      default: 1,
    },
    location: {
      type: String,
      trim: true,
    },

    // 3. Faculty & Schedule Details
    faculty: {
      type: String,
      required: [true, "Faculty or lead trainer name is required"],
      trim: true,
    },
    facultyId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    facultyEmail: {
      type: String,
      trim: true,
    },
    facultyPhone: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
      required: [true, "Training start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "Training end date is required"],
    },
    durationHours: {
      type: String,
      trim: true,
    },

    // 4. Commercials & Financials
    totalAmount: {
      type: Number,
      required: [true, "Total agreed commercial amount is required"],
      default: 0,
    },
    amountReceived: {
      type: Number,
      default: 0,
    },
    remainingBalance: {
      type: Number,
      default: 0,
    },
    paymentMode: {
      type: String,
      default: "Bank Transfer / NEFT",
    },
    paymentHistory: [CorporatePaymentRecordSchema],

    // 5. Scoping & Organization Assignments
    brand: {
      type: String,
      required: [true, "Brand scope is required"],
      trim: true,
      default: "CADD MANTRA",
    },
    companyAssigned: {
      type: String,
      trim: true,
      default: "INSTITUTE OF CREATIVE STUDIES",
    },
    salesExecutive: {
      type: String,
      trim: true,
    },
    salesExecutiveId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    centreHead: {
      type: String,
      trim: true,
    },
    centreHeadId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // 6. Status & Audit
    status: {
      type: String,
      enum: ["Scheduled", "Ongoing", "Completed", "Payment Pending", "Cancelled"],
      default: "Scheduled",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    createdByName: {
      type: String,
    },
    createdByRole: {
      type: String,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: auto-generate unique ID & compute remaining balance
CorporateTrainingSchema.pre("save", async function () {
  if (this.isModified("totalAmount") || this.isModified("amountReceived")) {
    this.remainingBalance = Math.max(0, (this.totalAmount || 0) - (this.amountReceived || 0));
  }

  if (!this.trainingId) {
    const year = new Date().getFullYear();
    const count = await mongoose.models.CorporateTraining?.countDocuments({}) || 0;
    const lastDoc = await (this.constructor as any).findOne({}).sort({ createdAt: -1 });
    let nextNum = count + 1;

    if (lastDoc && lastDoc.trainingId) {
      const match = lastDoc.trainingId.match(/\d+$/);
      if (match) {
        nextNum = parseInt(match[0], 10) + 1;
      }
    }

    this.trainingId = `CORP-${year}-${String(nextNum).padStart(4, "0")}`;
  }
});

export default mongoose.models.CorporateTraining ||
  mongoose.model("CorporateTraining", CorporateTrainingSchema);
