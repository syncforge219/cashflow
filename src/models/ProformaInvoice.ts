import mongoose, { Schema } from "mongoose";

const ProformaInvoiceItemSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: "QuotationProduct",
  },
  name: { type: String, required: true },
  description: { type: String, default: "" },
  quantity: { type: Schema.Types.Mixed, required: true },
  unit: { type: String, default: "mtr" },
  rate: { type: Number, required: true, min: 0 },
  gstRate: { type: Number, default: 18 },
  amount: { type: Number, required: true },
});

const ProformaInvoiceSchema = new Schema(
  {
    companyId: {
      type: String,
      default: "DEFAULT_COMPANY",
      index: true,
    },
    piNumber: {
      type: String,
      required: true,
      index: true,
    },
    quotationId: {
      type: Schema.Types.ObjectId,
      ref: "Quotation",
    },
    quotationNumber: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      default: "PRODUCT",
      index: true,
    },
    customCategoryName: {
      type: String,
      default: "",
    },
    billingCycle: {
      type: String,
      default: "ONE_TIME",
    },
    contractPeriod: {
      type: String,
      default: "",
    },
    date: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
    },
    poNumber: {
      type: String,
      default: "",
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "QuotationCustomer",
    },
    customerName: {
      type: String,
      required: true,
    },
    consigneeInfo: {
      type: String,
      default: "",
    },
    customerAddress: {
      type: String,
      default: "",
    },
    customerGstin: {
      type: String,
      default: "",
    },
    deliveryLocation: {
      type: String,
      default: "",
    },
    items: [ProformaInvoiceItemSchema],
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    gstRate: {
      type: Number,
      default: 18,
    },
    gstAmount: {
      type: Number,
      default: 0,
    },
    transportCharges: {
      type: Number,
      default: 0,
    },
    transportText: {
      type: String,
      default: "",
    },
    additionalCharges: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    amountInWords: {
      type: String,
      default: "",
    },
    termsAndConditions: {
      type: [String],
      default: [],
    },
    bankDetails: {
      bankName: { type: String, default: "" },
      branch: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      ifsc: { type: String, default: "" },
      rtgsCode: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["DRAFT", "ISSUED", "PAID", "CANCELLED"],
      default: "ISSUED",
      index: true,
    },
    createdBy: {
      type: String,
      default: "System",
    },

    // Snapshot company profile details
    companyName: { type: String, default: "" },
    companyLogo: { type: String, default: "" },
    companyGstin: { type: String, default: "" },
    companyCin: { type: String, default: "" },
    companyDescription: { type: String, default: "" },
    companyAddress: { type: String, default: "" },
    companyPhone: { type: String, default: "" },
    companyEmail: { type: String, default: "" },
    companyWebsite: { type: String, default: "" },
    companyWorksAddress: { type: String, default: "" },
    authorizedSignatory: { type: String, default: "" },
    signatureImage: { type: String, default: "" },
    stampImage: { type: String, default: "" },
  },
  { timestamps: true }
);

ProformaInvoiceSchema.index({ companyId: 1, piNumber: 1 });
ProformaInvoiceSchema.index({ companyId: 1, date: -1 });

delete (mongoose.models as any).ProformaInvoice;
const ProformaInvoice = mongoose.model("ProformaInvoice", ProformaInvoiceSchema);

export default ProformaInvoice;
