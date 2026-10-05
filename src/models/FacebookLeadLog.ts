import mongoose, { Schema, Document } from "mongoose";

export type FacebookLeadSourceType = "WEBHOOK" | "PULL_SYNC" | "SIMULATION_TEST";
export type FacebookLeadLogStatus = "SUCCESS" | "DUPLICATE" | "FAILED" | "UNAUTHORIZED";

export interface IFacebookLeadLog extends Document {
  timestamp: Date;
  sourceType: FacebookLeadSourceType;
  status: FacebookLeadLogStatus;
  leadgenId?: string;
  formId?: string;
  formName?: string;
  pageId?: string;
  adId?: string;
  campaignName?: string;
  platform?: string;
  leadName?: string;
  mobile?: string;
  email?: string;
  matchedCourse?: string;
  assignedCounselor?: string;
  brand?: string;
  enquiryId?: string;
  rawPayload?: any;
  responseMessage?: string;
  errorDetails?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FacebookLeadLogSchema = new Schema<IFacebookLeadLog>(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    sourceType: {
      type: String,
      enum: ["WEBHOOK", "PULL_SYNC", "SIMULATION_TEST"],
      default: "WEBHOOK",
    },
    status: {
      type: String,
      enum: ["SUCCESS", "DUPLICATE", "FAILED", "UNAUTHORIZED"],
      default: "SUCCESS",
      index: true,
    },
    leadgenId: { type: String, trim: true, index: true },
    formId: { type: String, default: "", trim: true },
    formName: { type: String, default: "", trim: true },
    pageId: { type: String, default: "", trim: true },
    adId: { type: String, default: "", trim: true },
    campaignName: { type: String, default: "", trim: true },
    platform: { type: String, default: "", trim: true },
    leadName: { type: String, default: "", trim: true },
    mobile: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    matchedCourse: { type: String, default: "", trim: true },
    assignedCounselor: { type: String, default: "", trim: true },
    brand: { type: String, default: "", trim: true },
    enquiryId: { type: String, default: "", trim: true },
    rawPayload: { type: Schema.Types.Mixed, default: {} },
    responseMessage: { type: String, default: "" },
    errorDetails: { type: String, default: "" },
  },
  { timestamps: true }
);

// A Meta lead can only be imported once, however many times the webhook or a pull sync delivers it
FacebookLeadLogSchema.index(
  { leadgenId: 1 },
  {
    unique: true,
    name: "uniq_success_leadgen",
    partialFilterExpression: { leadgenId: { $exists: true }, status: "SUCCESS" },
  }
);

if (mongoose.models.FacebookLeadLog) {
  delete mongoose.models.FacebookLeadLog;
}

const FacebookLeadLog = mongoose.model<IFacebookLeadLog>("FacebookLeadLog", FacebookLeadLogSchema);

export default FacebookLeadLog;
