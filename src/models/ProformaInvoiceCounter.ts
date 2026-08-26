import mongoose, { Schema } from "mongoose";

const ProformaInvoiceCounterSchema = new Schema({
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

ProformaInvoiceCounterSchema.index({ companyId: 1, financialYear: 1 }, { unique: true });

delete (mongoose.models as any).ProformaInvoiceCounter;
const ProformaInvoiceCounter = mongoose.model("ProformaInvoiceCounter", ProformaInvoiceCounterSchema);

export default ProformaInvoiceCounter;
