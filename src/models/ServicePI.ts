import mongoose, { Schema } from "mongoose";
import { amountFields, BUSINESS_TYPE_ENUM, ClientSnapshotSchema, CompanySnapshotSchema } from "./billingSchemas";

/**
 * Proforma invoice for agency (service) clients, raised only by GST companies.
 * Flow: GENERATED -> SENT -> PARTIALLY_PAID -> PAID -> tax invoice (taxInvoiceId set).
 * Separate from the quotation-based ProformaInvoice model, which stays as it is.
 */
const ServicePISchema = new Schema(
  {
    piNumber: { type: String, required: true, unique: true, trim: true },
    financialYear: { type: String, required: true, index: true },
    piDate: { type: Date, required: true, index: true },

    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    company: { type: CompanySnapshotSchema, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "QuotationCustomer", required: true, index: true },
    client: { type: ClientSnapshotSchema, required: true },

    businessType: { type: String, enum: BUSINESS_TYPE_ENUM, default: "DIGITAL_MARKETING" },
    description: { type: String, required: true, trim: true },
    // Service accounting code printed on GST documents (e.g. 998361 for advertising services)
    sacCode: { type: String, default: "", trim: true },
    billingPeriodFrom: { type: Date, required: true },
    billingPeriodTo: { type: Date, required: true },
    notes: { type: String, default: "", trim: true },

    ...amountFields,

    // Kept in step with the client's active receipts by recomputePiPayments()
    amountReceivedPaise: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["GENERATED", "SENT", "PARTIALLY_PAID", "PAID", "CANCELLED"],
      default: "GENERATED",
      index: true,
    },
    sentAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    cancelReason: { type: String, default: "" },
    taxInvoiceId: { type: Schema.Types.ObjectId, ref: "ServiceInvoice", default: null },
    source: { type: String, enum: ["MANUAL", "AUTO"], default: "MANUAL" },
  },
  { timestamps: true }
);

ServicePISchema.index({ clientId: 1, status: 1 });
ServicePISchema.index({ companyId: 1, piDate: -1 });

delete (mongoose.models as any).ServicePI;
const ServicePI = mongoose.model("ServicePI", ServicePISchema);

export default ServicePI;
