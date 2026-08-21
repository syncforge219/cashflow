import mongoose, { Schema } from "mongoose";

const QuotationCounterSchema = new Schema(
  {
    companyId: {
      type: String,
      default: "DEFAULT_COMPANY",
      index: true,
    },
    financialYear: {
      type: String,
      required: true,
      index: true,
    },
    seq: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

QuotationCounterSchema.index({ companyId: 1, financialYear: 1 }, { unique: true });

delete (mongoose.models as any).QuotationCounter;
const QuotationCounter = mongoose.model("QuotationCounter", QuotationCounterSchema);

export default QuotationCounter;
