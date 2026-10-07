import mongoose, { Schema } from "mongoose";

const QuotationCustomerSchema = new Schema(
  {
    companyId: {
      type: String,
      default: "DEFAULT_COMPANY",
      index: true,
    },
    name: {
      type: String,
      required: [true, "Customer Name is required"],
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
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
    gstin: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      default: "",
    },

    // ---- Billing client master (agency billing). Quotation screens ignore these. ----
    isBillingClient: {
      type: Boolean,
      default: false,
      index: true,
    },
    stateCode: {
      type: String,
      trim: true,
      default: "",
    },
    services: {
      type: [String],
      default: [],
    },
    // Line text used on PIs / invoices, e.g. "Digital Marketing Services"
    serviceDescription: {
      type: String,
      trim: true,
      default: "",
    },
    clientStatus: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    // Which of our companies may bill this client, and which one is pre-selected
    billingCompanyIds: [{ type: Schema.Types.ObjectId, ref: "Company" }],
    defaultBillingCompanyId: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
    billingCycle: {
      type: String,
      enum: ["MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY", "CUSTOM"],
      default: "MONTHLY",
    },
    customCycleMonths: {
      type: Number,
      min: 1,
      max: 24,
    },
    workStartDate: {
      type: Date,
      default: null,
    },
    // Day of month the PI is due to be raised (1–28)
    billingDay: {
      type: Number,
      min: 1,
      max: 28,
      default: 1,
    },
    autoGeneratePI: {
      type: Boolean,
      default: false,
    },
    // Base (pre-tax) amount per billing cycle; pre-fills PIs and is needed for auto-PI
    defaultBillingAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    billingNotes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

QuotationCustomerSchema.index({ isBillingClient: 1, clientStatus: 1 });

delete (mongoose.models as any).QuotationCustomer;
const QuotationCustomer = mongoose.model("QuotationCustomer", QuotationCustomerSchema);

export default QuotationCustomer;
