import mongoose, { Schema } from "mongoose";

const QuotationProfileSchema = new Schema(
  {
    companyId: {
      type: String,
      default: "DEFAULT_COMPANY",
      index: true,
    },
    name: {
      type: String,
      required: true,
      default: "SICCES PRIVATE LIMITED",
    },
    logo: {
      type: String,
      default: "",
    },
    gstin: {
      type: String,
      default: "09AASCS4608K1ZP",
    },
    cin: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "Providers of Software, Digital Marketing & Educational Services",
    },
    address: {
      type: String,
      default: "101, Vinayak Complex, Station Road",
    },
    city: {
      type: String,
      default: "JAIPUR",
    },
    state: {
      type: String,
      default: "Rajasthan",
    },
    pincode: {
      type: String,
      default: "302 001",
    },
    phone: {
      type: String,
      default: "0141-4059826",
    },
    telefax: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      default: "info@sicces.com",
    },
    website: {
      type: String,
      default: "www.sicces.com",
    },
    worksAddress: {
      type: String,
      default: "",
    },
    isoTag: {
      type: String,
      default: "",
    },
    bankDetails: {
      bankName: { type: String, default: "STATE BANK OF INDIA" },
      branch: { type: String, default: "SITAPURA IND. AREA JAIPUR" },
      accountNumber: { type: String, default: "61330464677" },
      ifsc: { type: String, default: "SBIN0031792" },
      rtgsCode: { type: String, default: "SBIN0031792" },
    },
    authorizedSignatory: {
      type: String,
      default: "AUTHORISED SIGNATORY",
    },
    signatureImage: {
      type: String,
      default: "",
    },
    stampImage: {
      type: String,
      default: "",
    },
    bankQrImage: {
      type: String,
      default: "",
    },
    brandLogo: {
      type: String,
      default: "",
    },
    defaultTerms: {
      type: [String],
      default: [
        "GST CHARGE EXTRA",
        "TRANSPORTATION INCLUDED",
        "PAYMENT ADVANCE",
        "ALL PIPE 6MTR LENGTH",
        "MATERIAL DELIVERD WITHIN 7DAYS",
      ],
    },
    categoryDefaultTerms: {
      type: Schema.Types.Mixed,
      default: {},
    },
    prefix: {
      type: String,
      default: "SICCES",
    },
  },
  { timestamps: true }
);

delete (mongoose.models as any).QuotationProfile;
const QuotationProfile = mongoose.model("QuotationProfile", QuotationProfileSchema);

export default QuotationProfile;
