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
      default: "",
    },
    logo: {
      type: String,
      default: "",
    },
    gstin: {
      type: String,
      default: "",
    },
    cin: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    city: {
      type: String,
      default: "",
    },
    state: {
      type: String,
      default: "",
    },
    pincode: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    telefax: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      default: "",
    },
    website: {
      type: String,
      default: "",
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
      bankName: { type: String, default: "" },
      branch: { type: String, default: "" },
      accountNumber: { type: String, default: "", select: false },
      ifsc: { type: String, default: "" },
      rtgsCode: { type: String, default: "" },
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
      default: "QTN",
    },
  },
  { timestamps: true }
);

import { encryptField } from "@/lib/encryption";

QuotationProfileSchema.pre("save", async function () {
  if (this.bankDetails && this.bankDetails.accountNumber && typeof this.bankDetails.accountNumber === "string") {
    this.bankDetails.accountNumber = encryptField(this.bankDetails.accountNumber) || this.bankDetails.accountNumber;
  }
});

QuotationProfileSchema.pre(["findOneAndUpdate", "updateOne"], async function () {
  const update = this.getUpdate() as any;
  if (update) {
    const target = update.$set || update;
    if (target.bankDetails && target.bankDetails.accountNumber && typeof target.bankDetails.accountNumber === "string") {
      target.bankDetails.accountNumber = encryptField(target.bankDetails.accountNumber) || target.bankDetails.accountNumber;
    }
    if (target["bankDetails.accountNumber"] && typeof target["bankDetails.accountNumber"] === "string") {
      target["bankDetails.accountNumber"] = encryptField(target["bankDetails.accountNumber"]) || target["bankDetails.accountNumber"];
    }
  }
});

delete (mongoose.models as any).QuotationProfile;
const QuotationProfile = mongoose.model("QuotationProfile", QuotationProfileSchema);

export default QuotationProfile;
