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
  },
  {
    timestamps: true,
  }
);

if (mongoose.models.JustdialConfig) {
  delete mongoose.models.JustdialConfig;
}

const JustdialConfig = mongoose.model("JustdialConfig", JustdialConfigSchema);

export default JustdialConfig;
