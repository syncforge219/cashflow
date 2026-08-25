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
      default: "AARAM PLASTICS PVT. LTD.",
    },
    logo: {
      type: String,
      default: "",
    },
    gstin: {
      type: String,
      default: "08AABCA5691D1ZS",
    },
    cin: {
      type: String,
      default: "U25209RJ1996PTC011513",
    },
    description: {
      type: String,
      default: "Manufacturers of : ISI MARKED 'GANGOTRI' HDPE PIPES, SPRINKLER SYSTEM AND PLB TELECOM DUCTS",
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
      default: "0141-2370336",
    },
    email: {
      type: String,
      default: "appl_jaipur@rediffmail.com",
    },
    website: {
      type: String,
      default: "www.aaramplastics.com",
    },
    worksAddress: {
      type: String,
      default: "G-232, Sitapura Ind. Area, Tonk Road, JAIPUR - 302 022 (Raj.) Tel. : 0141-2771862",
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
    prefix: {
      type: String,
      default: "APPL",
    },
  },
  { timestamps: true }
);

delete (mongoose.models as any).QuotationProfile;
const QuotationProfile = mongoose.model("QuotationProfile", QuotationProfileSchema);

export default QuotationProfile;
