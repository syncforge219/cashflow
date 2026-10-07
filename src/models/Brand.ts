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
    // MSG91 WhatsApp sender number for this brand (falls back to the first MSG91_INTEGRATED_NUMBER in .env)
    integratedNumber: {
      type: String,
    },
    // Optional per-brand WhatsApp template overrides, for brands on their own WhatsApp Business account
    whatsappNamespace: {
      type: String,
      trim: true,
    },
    whatsappWelcomeTemplate: {
      type: String,
      trim: true,
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
    // Training institute vs service business (e.g. digital marketing agency).
    // Older brands have no value and are treated as TRAINING (see brandCategoryOf).
    businessCategory: {
      type: String,
      enum: ["TRAINING", "SERVICE"],
      index: true,
    },
    // The brand used when a record arrives without one (public forms, lead connectors).
    // At most one brand should have this set; see lib/brandDefaults.ts.
    isDefault: {
      type: Boolean,
      default: false,
    },
    // WhatsApp the assigned teacher when a demo class is scheduled for this brand's leads
    sendTeacherDemoAlert: {
      type: Boolean,
      default: false,
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
