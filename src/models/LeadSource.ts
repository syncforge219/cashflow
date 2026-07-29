import mongoose, { Schema, Document } from "mongoose";

export interface ILeadSource extends Document {
  name: string;
  isSystem?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSourceSchema = new Schema<ILeadSource>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.LeadSource || mongoose.model<ILeadSource>("LeadSource", LeadSourceSchema);
