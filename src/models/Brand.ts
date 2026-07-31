import mongoose from "mongoose";

const BrandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    code: {
      type: String,
    },
    logoUrl: {
      type: String,
    },
    description: {
      type: String,
    },
    phone: {
      type: String,
    },
    whatsappNumber: {
      type: String,
    },
    integratedNumber: {
      type: String,
    },
    email: {
      type: String,
    },
    website: {
      type: String,
    },
    address: {
      type: String,
    },
    status: {
      type: String,
      default: "ACTIVE",
      enum: ["ACTIVE", "INACTIVE"],
    },
    companies: {
      type: [String],
      default: [],
    },
    brandId: {
      type: String,
      unique: true,
    },
    receiptTemplateUrl: {
      type: String,
    },
    receiptTerms: {
      type: String,
    },
    youtubeUrl: {
      type: String,
    },
    facebookUrl: {
      type: String,
    },
    instagramUrl: {
      type: String,
    },
    brochureDriveUrl: {
      type: String,
    },
  },
  { timestamps: true }
);

// Pre-save hook to generate unique brandId and convert brand name/code to UPPERCASE
BrandSchema.pre("save", async function () {
  if (this.name) {
    this.name = this.name.toUpperCase().trim();
  }
  if (!this.brandId) {
    this.brandId = `BRD-${Date.now()}`;
  }
  if (!this.code && this.name) {
    this.code = this.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  } else if (this.code) {
    this.code = this.code.toUpperCase().trim();
  }
  if (Array.isArray(this.companies)) {
    this.companies = this.companies.map((c: string) => c.toUpperCase().trim());
  }
});

if (mongoose.models.Brand) {
  delete mongoose.models.Brand;
}

const Brand = mongoose.model("Brand", BrandSchema);

export default Brand;
