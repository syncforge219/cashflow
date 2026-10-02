import mongoose, { Schema, Document } from "mongoose";

export interface IStudentMergeIgnore extends Document {
  recordIdA: string;
  recordIdB: string;
  phoneOrEmail: string;
  ignoredBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const StudentMergeIgnoreSchema = new Schema<IStudentMergeIgnore>(
  {
    recordIdA: { type: String, required: true, index: true },
    recordIdB: { type: String, required: true, index: true },
    phoneOrEmail: { type: String, default: "", index: true },
    ignoredBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

StudentMergeIgnoreSchema.index({ recordIdA: 1, recordIdB: 1 }, { unique: true });

if (mongoose.models.StudentMergeIgnore) {
  delete mongoose.models.StudentMergeIgnore;
}

export default mongoose.model<IStudentMergeIgnore>("StudentMergeIgnore", StudentMergeIgnoreSchema);
