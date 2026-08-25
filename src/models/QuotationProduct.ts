import mongoose, { Schema } from "mongoose";

const QuotationProductSchema = new Schema(
  {
    companyId: {
      type: String,
      default: "DEFAULT_COMPANY",
      index: true,
    },
    category: {
      type: String,
      enum: ["SOFTWARE", "DIGITAL_MARKETING", "PRODUCT", "SERVICE", "CUSTOM"],
      default: "PRODUCT",
      index: true,
    },
    billingCycle: {
      type: String,
      enum: ["ONE_TIME", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY", "CUSTOM"],
      default: "ONE_TIME",
    },
    name: {
      type: String,
      required: [true, "Product Name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    sku: {
      type: String,
      trim: true,
      default: "",
    },
    hsnCode: {
      type: String,
      trim: true,
      default: "",
    },
    unit: {
      type: String,
      default: "mtr",
      trim: true,
    },
    defaultRate: {
      type: Number,
      default: 0,
    },
    gstRate: {
      type: Number,
      default: 18,
    },
    defaultTerms: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

delete (mongoose.models as any).QuotationProduct;
const QuotationProduct = mongoose.model("QuotationProduct", QuotationProductSchema);

export default QuotationProduct;
