import mongoose, { Schema } from "mongoose";
import { amountFields, BUSINESS_TYPE_ENUM, ClientSnapshotSchema, CompanySnapshotSchema } from "./billingSchemas";

/**
 * Final invoices for agency clients:
 *  - TAX_INVOICE: GST company, generated from a fully paid ServicePI (piId), CGST/SGST or IGST
 *  - NON_GST_INVOICE: Non-GST company, raised directly, no tax
 * Invoices are locked at creation: the API never edits or deletes them. Corrections need a credit note.
 */
const ServiceInvoiceSchema = new Schema(
  {
    invoiceType: { type: String, enum: ["TAX_INVOICE", "NON_GST_INVOICE"], required: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    financialYear: { type: String, required: true, index: true },
    invoiceDate: { type: Date, required: true, index: true },

    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    company: { type: CompanySnapshotSchema, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "QuotationCustomer", required: true, index: true },
    client: { type: ClientSnapshotSchema, required: true },

    // Tax invoice <-> PI link (unique: one tax invoice per PI)
    piId: { type: Schema.Types.ObjectId, ref: "ServicePI", default: null },
    piNumber: { type: String, default: "" },

    saleType: { type: String, enum: ["REGISTERED", "UNREGISTERED", "NON_GST"], required: true, index: true },
    businessType: { type: String, enum: BUSINESS_TYPE_ENUM, default: "DIGITAL_MARKETING" },
    description: { type: String, required: true, trim: true },
    // Service accounting code printed on GST documents (e.g. 998361 for advertising services)
    sacCode: { type: String, default: "", trim: true },
    billingPeriodFrom: { type: Date, required: true },
    billingPeriodTo: { type: Date, required: true },
    notes: { type: String, default: "", trim: true },

    ...amountFields,

    // Tax invoices are fully paid by definition; Non-GST invoices track their own receipts
    amountReceivedPaise: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: ["UNPAID", "PARTIALLY_PAID", "PAID"], default: "UNPAID", index: true },

    isLocked: { type: Boolean, default: true },
    lockedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ServiceInvoiceSchema.index({ piId: 1 }, { unique: true, partialFilterExpression: { piId: { $type: "objectId" } } });
ServiceInvoiceSchema.index({ clientId: 1, invoiceDate: -1 });

delete (mongoose.models as any).ServiceInvoice;
const ServiceInvoice = mongoose.model("ServiceInvoice", ServiceInvoiceSchema);

export default ServiceInvoice;
