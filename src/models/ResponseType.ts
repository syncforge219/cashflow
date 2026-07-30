import mongoose, { Schema, Document } from "mongoose";

export interface IResponseType extends Document {
  name: string;
  remarks?: string;
  isSystem?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ResponseTypeSchema = new Schema<IResponseType>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    remarks: { type: String, default: "" },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.ResponseType || mongoose.model<IResponseType>("ResponseType", ResponseTypeSchema);
