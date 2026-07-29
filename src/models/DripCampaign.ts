import mongoose, { Schema } from "mongoose";

const DripStepSchema = new Schema({
  stepNumber: { type: Number, required: true },
  delayDays: { type: Number, default: 0 },
  delayHours: { type: Number, default: 0 },
  title: { type: String, required: true },
  messageTemplate: { type: String, required: true },
  channel: { type: String, enum: ["WhatsApp", "Email", "SMS", "Omnichannel"], default: "WhatsApp" },
  sentCount: { type: Number, default: 0 },
  deliveredCount: { type: Number, default: 0 },
});

const DripCampaignSchema = new Schema(
  {
    campaignId: { type: String, unique: true },
    campaignName: { type: String, required: true, trim: true },
    targetAudience: {
      type: String,
      enum: ["All Leads", "New Enquiries", "Unconverted Leads", "Fee Pending Students", "Specific Course"],
      default: "All Leads",
    },
    targetCourse: { type: String, default: "All Courses" },
    brandScope: { type: String, default: "ALL BRANDS" },
    channel: { type: String, enum: ["WhatsApp", "Email", "SMS", "Omnichannel"], default: "WhatsApp" },
    status: { type: String, enum: ["Active", "Paused", "Completed", "Draft"], default: "Active" },
    totalTargetLeads: { type: Number, default: 0 },
    totalMessagesSent: { type: Number, default: 0 },
    convertedCount: { type: Number, default: 0 },
    steps: [DripStepSchema],
  },
  { timestamps: true }
);

DripCampaignSchema.pre("save", async function () {
  if (this.campaignName) {
    this.campaignName = this.campaignName.trim();
  }
  if (this.brandScope) {
    this.brandScope = this.brandScope.toUpperCase().trim();
  }
  if (!this.campaignId) {
    this.campaignId = `DRIP-${Date.now()}`;
  }
});

if (mongoose.models.DripCampaign) {
  delete mongoose.models.DripCampaign;
}

const DripCampaign = mongoose.model("DripCampaign", DripCampaignSchema);

export default DripCampaign;
