import mongoose, { Schema } from "mongoose";
import { encryptField } from "@/lib/encryption";

// Routes a specific Lead Ads form to a course / brand / counsellor
const FormMappingSchema = new Schema({
  formId: { type: String, required: true, trim: true },
  formName: { type: String, default: "", trim: true },
  course: { type: String, default: "", trim: true },
  brand: { type: String, default: "", trim: true },
  counselorName: { type: String, default: "", trim: true },
});

const SECRET_FIELDS = ["appSecret", "pageAccessToken"] as const;

const FacebookLeadConfigSchema = new Schema(
  {
    // Meta App / Page credentials
    pageId: { type: String, default: "", trim: true },
    pageName: { type: String, default: "", trim: true },
    graphApiVersion: { type: String, default: "v26.0", trim: true },
    // Shared with Meta when registering the webhook callback (not a secret on its own)
    verifyToken: { type: String, default: "", trim: true },
    appSecret: { type: String, default: "", trim: true, select: false },
    pageAccessToken: { type: String, default: "", trim: true, select: false },

    // Enquiry defaults
    leadSource: { type: String, default: "Meta Ads", trim: true },
    leadStage: { type: String, default: "New / Fresh Inquiry", trim: true },
    defaultBrand: { type: String, default: "CADD MANTRA", trim: true },
    counselorName: { type: String, default: "HO - TARANG SINGHAL - SICCES PVT LTD", trim: true },
    defaultCourse: { type: String, default: "", trim: true },

    // Automation toggles
    sendWelcomeWhatsApp: { type: Boolean, default: true },
    sendAdminAlertWhatsApp: { type: Boolean, default: true },
    createFollowUpTask: { type: Boolean, default: true },

    formMappings: [FormMappingSchema],

    // Marketing user who set up this connector: leads arriving through it are attributed to them
    connectedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    connectedByName: { type: String, default: "", trim: true },

    // Stats
    totalLeadsReceived: { type: Number, default: 0 },
    lastLeadReceivedAt: { type: Date },
    lastSyncAt: { type: Date },
  },
  { timestamps: true }
);

// Encrypt secrets at rest (encryptField is idempotent, so re-saves are safe)
FacebookLeadConfigSchema.pre("save", async function () {
  for (const field of SECRET_FIELDS) {
    const val = this.get(field);
    if (val && typeof val === "string") {
      this.set(field, encryptField(val) || val);
    }
  }
});

FacebookLeadConfigSchema.pre(["findOneAndUpdate", "updateOne"], async function () {
  const update = this.getUpdate() as any;
  if (!update) return;
  const target = update.$set || update;
  for (const field of SECRET_FIELDS) {
    if (target[field] && typeof target[field] === "string") {
      target[field] = encryptField(target[field]) || target[field];
    }
  }
});

if (mongoose.models.FacebookLeadConfig) {
  delete mongoose.models.FacebookLeadConfig;
}

const FacebookLeadConfig = mongoose.model("FacebookLeadConfig", FacebookLeadConfigSchema);

export default FacebookLeadConfig;
