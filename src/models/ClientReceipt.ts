import mongoose, { Schema } from "mongoose";
import { BUSINESS_TYPE_ENUM } from "./billingSchemas";

/**
 * Money received from an agency client: the single source of truth for collections reports.
 * Each receipt names the company, the bank account it landed in and the PI / invoice it pays.
 * Receipts are never deleted; a wrong entry is VOIDED (only while its PI has no tax invoice).
 */
const ClientReceiptSchema = new Schema(
  {
    receiptNumber: { type: String, required: true, unique: true, trim: true },
    financialYear: { type: String, required: true, index: true },
    receiptDate: { type: Date, required: true, index: true },

    clientId: { type: Schema.Types.ObjectId, ref: "QuotationCustomer", required: true, index: true },
    clientName: { type: String, default: "" },
    clientGstin: { type: String, default: "" },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    companyName: { type: String, default: "" },
    bankAccountId: { type: Schema.Types.ObjectId, ref: "BankAccount", required: true, index: true },
    bankLabel: { type: String, default: "" },

    linkedDocType: { type: String, enum: ["PI", "INVOICE"], required: true },
    piId: { type: Schema.Types.ObjectId, ref: "ServicePI", default: null, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: "ServiceInvoice", default: null, index: true },
    linkedDocNumber: { type: String, default: "" },

    businessType: { type: String, enum: BUSINESS_TYPE_ENUM, default: "DIGITAL_MARKETING" },
    gstApplicable: { type: Boolean, required: true },
    amountPaise: { type: Number, required: true, min: 1 },
    paymentMode: { type: String, enum: ["NEFT", "RTGS", "IMPS", "UPI", "CHEQUE", "CASH", "OTHER"], default: "NEFT" },
    transactionRef: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },

    status: { type: String, enum: ["ACTIVE", "VOIDED"], default: "ACTIVE", index: true },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    voidReason: { type: String, default: "" },
  },
  { timestamps: true }
);

ClientReceiptSchema.index({ bankAccountId: 1, receiptDate: -1 });
ClientReceiptSchema.index({ companyId: 1, receiptDate: -1 });

delete (mongoose.models as any).ClientReceipt;
const ClientReceipt = mongoose.model("ClientReceipt", ClientReceiptSchema);

export default ClientReceipt;
