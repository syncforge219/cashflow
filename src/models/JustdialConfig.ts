import mongoose, { Schema } from "mongoose";

const CourseMappingSchema = new Schema({
  course: { type: String, required: true, trim: true },
  justdialCategory: { type: String, required: true, trim: true },
  counselorName: { type: String, default: "", trim: true },
  brand: { type: String, default: "", trim: true },
});

const JustdialConfigSchema = new Schema(
  {
    connectorType: {
      type: String,
      default: "Justdial Lead Connector Push API",
      trim: true,
    },
    leadSource: {
      type: String,
      default: "JustDial",
      trim: true,
    },
    leadStage: {
      type: String,
      default: "New / Fresh Inquiry",
      trim: true,
    },
    defaultBrand: {
      type: String,
      default: "CADD MANTRA",
      trim: true,
    },
    counselorName: {
      type: String,
      default: "HO - TARANG SINGHAL - SICCES PVT LTD",
      trim: true,
    },
    defaultCourse: {
      type: String,
      default: "",
      trim: true,
    },
    apiKey: {
      type: String,
      default: "JD-CF-API-KEY-984729103847",
      trim: true,
      select: false,
    },
    webhookSecret: {
      type: String,
      default: "",
      trim: true,
      select: false,
    },
    requireApiKey: {
      type: Boolean,
      default: false,
    },
    autoAssignAdvisor: {
      type: Boolean,
      default: true,
    },
    sendWelcomeWhatsApp: {
      type: Boolean,
      default: true,
    },
    sendAdminAlertWhatsApp: {
      type: Boolean,
      default: true,
    },
    createFollowUpTask: {
      type: Boolean,
      default: true,
    },
    pullApiUrl: {
      type: String,
      default: "",
      trim: true,
    },
    pullApiClientId: {
      type: String,
      default: "",
      trim: true,
    },
    pullApiKey: {
      type: String,
      default: "",
      trim: true,
      select: false,
    },
    pullApiMobile: {
      type: String,
      default: "",
      trim: true,
    },
    apiLastUpdatedTime: {
      type: Date,
      default: Date.now,
    },
    totalLeadsReceived: {
      type: Number,
      default: 0,
    },
    lastLeadReceivedAt: {
      type: Date,
    },
    lastSyncAt: {
      type: Date,
    },
    courseMappings: [CourseMappingSchema],
    // Marketing user who set up this connector: leads arriving through it are attributed to them
    connectedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    connectedByName: { type: String, default: "", trim: true },
  },
  {
    timestamps: true,
  }
);

import { encryptField } from "@/lib/encryption";

// Automatically encrypt secrets at rest before save
JustdialConfigSchema.pre("save", async function () {
  if (this.apiKey && typeof this.apiKey === "string") {
    this.apiKey = encryptField(this.apiKey) || this.apiKey;
  }
  if (this.webhookSecret && typeof this.webhookSecret === "string") {
    this.webhookSecret = encryptField(this.webhookSecret) || this.webhookSecret;
  }
  if (this.pullApiKey && typeof this.pullApiKey === "string") {
    this.pullApiKey = encryptField(this.pullApiKey) || this.pullApiKey;
  }
});

JustdialConfigSchema.pre(["findOneAndUpdate", "updateOne"], async function () {
  const update = this.getUpdate() as any;
  if (update) {
    const target = update.$set || update;
    if (target.apiKey && typeof target.apiKey === "string") {
      target.apiKey = encryptField(target.apiKey) || target.apiKey;
    }
    if (target.webhookSecret && typeof target.webhookSecret === "string") {
      target.webhookSecret = encryptField(target.webhookSecret) || target.webhookSecret;
    }
    if (target.pullApiKey && typeof target.pullApiKey === "string") {
      target.pullApiKey = encryptField(target.pullApiKey) || target.pullApiKey;
    }
  }
});

if (mongoose.models.JustdialConfig) {
  delete mongoose.models.JustdialConfig;
}

const JustdialConfig = mongoose.model("JustdialConfig", JustdialConfigSchema);

export default JustdialConfig;
