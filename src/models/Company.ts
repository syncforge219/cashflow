import mongoose, { Schema } from "mongoose";

const CompanySchema = new Schema(
  {
    companyId: {
      type: String,
      unique: true,
    },
    uniqueId: {
      type: String,
      unique: true,
      sparse: true,
    },
    name: {
      type: String,
      required: [true, "Company Name is required"],
      trim: true,
    },
    legalName: {
      type: String,
      trim: true,
    },
    gst: {
      type: String,
      default: "Not Provided",
      trim: true,
    },
    pan: {
      type: String,
      default: "Not Provided",
      trim: true,
    },
    bank: {
      type: String,
      default: "Bank Of India",
      trim: true,
    },
    bankDetails: {
      bankName: { type: String, default: "" },
      branch: { type: String, default: "" },
      accountNumber: { type: String, default: "", select: false },
      ifsc: { type: String, default: "" },
      rtgsCode: { type: String, default: "" },
    },
    annualCapacityCap: {
      type: Number,
      default: 1949999,
    },
    annualCapacityCapPaise: {
      type: Number,
      default: 194999900,
    },
    collectedRevenue: {
      type: Number,
      default: 0,
    },
    collectedRevenuePaise: {
      type: Number,
      default: 0,
    },
    currentFinancialYear: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "No listed street, No City, No State, PIN",
      trim: true,
    },
    brands: {
      type: [String],
      default: [],
    },
    qrCodeUrl: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      default: "ACTIVE",
      enum: ["ACTIVE", "INACTIVE"],
    },
    alerted80Percent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

import { encryptField } from "@/lib/encryption";

CompanySchema.pre("save", async function () {
  if (this.name) {
    this.name = this.name.toUpperCase().trim();
  }
  if (this.legalName) {
    this.legalName = this.legalName.toUpperCase().trim();
  }
  if (Array.isArray(this.brands)) {
    this.brands = this.brands.map((b: string) => b.toUpperCase().trim());
  }

  // Encrypt bankDetails.accountNumber at rest
  if (this.bankDetails && this.bankDetails.accountNumber && typeof this.bankDetails.accountNumber === "string") {
    this.bankDetails.accountNumber = encryptField(this.bankDetails.accountNumber) || this.bankDetails.accountNumber;
  }

  if (!this.companyId) {
    const count = await mongoose.models.Company.countDocuments();
    this.companyId = `COMP-${Date.now()}${count + 1}`;
  }
  if (!this.uniqueId) {
    const lastCompany = await mongoose.models.Company.findOne({
      uniqueId: /^COMP\d+$/
    }).sort({ uniqueId: -1 });

    let nextNumber = 1;
    if (lastCompany && lastCompany.uniqueId) {
      const match = lastCompany.uniqueId.match(/^COMP(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    this.uniqueId = `COMP${String(nextNumber).padStart(6, "0")}`;
  }
});

CompanySchema.pre(["findOneAndUpdate", "updateOne"], async function () {
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

delete mongoose.models.Company;
const Company = mongoose.model("Company", CompanySchema);

export default Company;
