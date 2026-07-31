import mongoose, { Schema } from "mongoose";

const CourseMappingSchema = new Schema({
  course: { type: String, required: true },
  justdialCategory: { type: String, required: true },
  counselorName: { type: String, required: true },
});

const JustdialConfigSchema = new Schema(
  {
    connectorType: {
      type: String,
      default: "Justdial Lead Connector Push API",
    },
    leadSource: {
      type: String,
      default: "JustDial",
    },
    leadStage: {
      type: String,
      default: "New / Fresh Inquiry",
    },
    counselorName: {
      type: String,
      default: "HO - TARANG SINGHAL - SICCES PVT LTD",
    },
    defaultCourse: {
      type: String,
      default: "",
    },
    apiKey: {
      type: String,
      default: "JD-CF-API-KEY-984729103847",
    },
    apiLastUpdatedTime: {
      type: Date,
      default: Date.now,
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
