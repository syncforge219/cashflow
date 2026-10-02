import mongoose, { Schema } from "mongoose";

export interface IBiometricProfile {
  userId: mongoose.Types.ObjectId;
  descriptors: string; // AES-256-GCM encrypted facial descriptor vector (JSON string)
  consentGivenAt: Date;
  consentVersion: string;
  expiresAt: Date;
  enrolledBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BiometricProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    descriptors: {
      type: String,
      required: true,
      select: false, // Never return raw biometric data in normal queries
    },
    consentGivenAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    consentVersion: {
      type: String,
      required: true,
      default: "DPDP-2023-V1",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    enrolledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    collection: "biometric_profiles",
    timestamps: true,
  }
);

if (mongoose.models && mongoose.models.BiometricProfile) {
  delete (mongoose.models as any).BiometricProfile;
}

const BiometricProfile = mongoose.model("BiometricProfile", BiometricProfileSchema);

export default BiometricProfile;
