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
    annualCapacityCap: {
      type: Number,
      default: 1949999,
    },
    collectedRevenue: {
      type: Number,
      default: 0,
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

delete mongoose.models.Company;
const Company = mongoose.model("Company", CompanySchema);

export default Company;
