import mongoose, { Schema, Document } from "mongoose";

export interface IAuditChange {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface IAuditLog {
  _id?: any;
  collection: string;
  docId: any;
  action: "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "SOFT_DELETE" | string;
  changedFields: IAuditChange[];
  userId?: mongoose.Types.ObjectId | null;
  at: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const AuditLogSchema: Schema = new Schema(
  {
    collection: { type: String, required: true, index: true },
    docId: { type: Schema.Types.Mixed, required: true, index: true },
    action: { type: String, required: true, index: true },
    changedFields: [
      {
        field: { type: String, required: true },
        oldValue: { type: Schema.Types.Mixed, default: null },
        newValue: { type: Schema.Types.Mixed, default: null },
      },
    ],
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true, default: null },
    at: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: true,
    collection: "audit_logs",
    suppressReservedKeysWarning: true,
  }
);

AuditLogSchema.index({ collection: 1, docId: 1, at: -1 });
AuditLogSchema.index({ userId: 1, at: -1 });

if (mongoose.models.AuditLog) {
  delete mongoose.models.AuditLog;
}

export default mongoose.model<IAuditLog>("AuditLog", AuditLogSchema, "audit_logs");
