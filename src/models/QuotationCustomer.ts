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
  },
  { timestamps: true }
);

delete (mongoose.models as any).QuotationCustomer;
const QuotationCustomer = mongoose.model("QuotationCustomer", QuotationCustomerSchema);

export default QuotationCustomer;
