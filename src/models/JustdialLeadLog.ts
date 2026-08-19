import mongoose, { Schema, Document } from "mongoose";

export interface IJustdialLeadLog extends Document {
  timestamp: Date;
  sourceType: "PUSH_WEBHOOK" | "PULL_API" | "SIMULATION_TEST";
  httpMethod: string;
  status: "SUCCESS" | "DUPLICATE" | "FAILED" | "UNAUTHORIZED";
  leadName?: string;
  mobile?: string;
  email?: string;
  category?: string;
  matchedCourse?: string;
  assignedCounselor?: string;
  brand?: string;
  enquiryId?: string;
  rawPayload?: any;
  responseMessage?: string;
  errorDetails?: string;
  ip?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JustdialLeadLogSchema = new Schema<IJustdialLeadLog>(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["PUSH_WEBHOOK", "PULL_API", "SIMULATION_TEST"],
      default: "PUSH_WEBHOOK",
    },
    httpMethod: {
      type: String,
      default: "POST",
    },
    status: {
      type: String,
      enum: ["SUCCESS", "DUPLICATE", "FAILED", "UNAUTHORIZED"],
      default: "SUCCESS",
      index: true,
    },
    leadName: {
      type: String,
      default: "",
      trim: true,
    },
    mobile: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
    },
    category: {
      type: String,
      default: "",
      trim: true,
    },
    matchedCourse: {
      type: String,
      default: "",
      trim: true,
    },
    assignedCounselor: {
      type: String,
      default: "",
      trim: true,
    },
    brand: {
      type: String,
      default: "",
      trim: true,
    },
    enquiryId: {
      type: String,
      default: "",
      trim: true,
    },
    rawPayload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    responseMessage: {
      type: String,
      default: "",
    },
    errorDetails: {
      type: String,
      default: "",
    },
    ip: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

if (mongoose.models.JustdialLeadLog) {
  delete mongoose.models.JustdialLeadLog;
}

const JustdialLeadLog =
  mongoose.models.JustdialLeadLog ||
  mongoose.model<IJustdialLeadLog>("JustdialLeadLog", JustdialLeadLogSchema);

export default JustdialLeadLog;
