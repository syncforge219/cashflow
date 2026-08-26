import mongoose, { Schema } from "mongoose";

const PurchaseOrderCounterSchema = new Schema({
  companyId: {
    type: String,
    required: true,
  },
  financialYear: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

PurchaseOrderCounterSchema.index({ companyId: 1, financialYear: 1 }, { unique: true });

delete (mongoose.models as any).PurchaseOrderCounter;
const PurchaseOrderCounter = mongoose.model("PurchaseOrderCounter", PurchaseOrderCounterSchema);

export default PurchaseOrderCounter;
