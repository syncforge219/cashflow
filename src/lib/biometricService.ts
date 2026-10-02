import mongoose from "mongoose";
import BiometricProfile from "@/models/BiometricProfile";
import User from "@/models/User";
import { encryptJson, decryptJson } from "@/lib/encryption";
import { compareFaceDescriptors } from "@/lib/faceVerification";

export const DEFAULT_DPDP_CONSENT_VERSION = "DPDP-2023-V1";
export const BIOMETRIC_RETENTION_DAYS = 365; // 1 year retention

export interface EnrollBiometricInput {
  userId: string | mongoose.Types.ObjectId;
  faceDescriptor: number[];
  consentGiven: boolean;
  consentVersion?: string;
  enrolledBy?: string | mongoose.Types.ObjectId;
}

export interface VerifyBiometricResult {
  isMatch: boolean;
  confidencePct: number;
  similarity: number;
}

/**
 * Enrolls a user's biometric facial profile in accordance with the DPDP Act 2023:
 * 1. Strictly enforces informed user consent prior to processing.
 * 2. Encrypts facial descriptors with AES-256-GCM.
 * 3. Stores in the isolated biometric_profiles collection with an expiration timestamp.
 * 4. Cleanses User document of any raw biometric vectors.
 */
export async function enrollBiometricProfile(input: EnrollBiometricInput) {
  const { userId, faceDescriptor, consentGiven, consentVersion, enrolledBy } = input;

  if (!consentGiven) {
    throw new Error(
      "DPDP ACT 2023 COMPLIANCE ERROR: Explicit user consent is mandatory for collecting and processing biometric facial data."
    );
  }

  if (!Array.isArray(faceDescriptor) || faceDescriptor.length === 0) {
    throw new Error("Invalid biometric data: facial descriptor vector is required.");
  }

  const uId = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;
  const user = await User.findById(uId);
  if (!user) {
    throw new Error("User not found.");
  }

  // Encrypt descriptors vector with AES-256-GCM
  const encryptedDescriptors = encryptJson(faceDescriptor);
  if (!encryptedDescriptors) {
    throw new Error("Failed to securely encrypt biometric data.");
  }

  const expiresAt = new Date(Date.now() + BIOMETRIC_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Store in isolated biometric_profiles collection
  const profile = await BiometricProfile.findOneAndUpdate(
    { userId: uId },
    {
      userId: uId,
      descriptors: encryptedDescriptors,
      consentGivenAt: new Date(),
      consentVersion: consentVersion || DEFAULT_DPDP_CONSENT_VERSION,
      expiresAt,
      enrolledBy: enrolledBy ? new mongoose.Types.ObjectId(String(enrolledBy)) : undefined,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Mark user as registered, but strip any raw biometric vectors from User model
  user.isFaceRegistered = true;
  user.faceRegisteredAt = new Date();
  user.faceDescriptor = []; // Erase from User document
  await user.save();

  return {
    success: true,
    userId: uId.toString(),
    consentGivenAt: profile.consentGivenAt,
    consentVersion: profile.consentVersion,
    expiresAt: profile.expiresAt,
  };
}

/**
 * Retrieves and decrypts a user's stored biometric facial descriptor.
 * Strictly restricted to attendance service validation.
 */
export async function getBiometricDescriptor(
  userId: string | mongoose.Types.ObjectId
): Promise<number[] | null> {
  const uId = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

  const profile = await BiometricProfile.findOne({ userId: uId })
    .select("+descriptors")
    .lean();

  if (!profile || !profile.descriptors) {
    return null;
  }

  if (profile.expiresAt && new Date(profile.expiresAt).getTime() < Date.now()) {
    console.warn(`Biometric profile for user ${uId} has expired under DPDP data retention rules.`);
    return null;
  }

  return decryptJson<number[]>(profile.descriptors);
}

/**
 * Verifies live facial descriptor against registered biometric profile.
 */
export async function verifyBiometricProfile(
  userId: string | mongoose.Types.ObjectId,
  liveDescriptor: number[]
): Promise<VerifyBiometricResult> {
  const registeredDescriptor = await getBiometricDescriptor(userId);

  if (!registeredDescriptor || registeredDescriptor.length === 0) {
    return {
      isMatch: false,
      confidencePct: 0,
      similarity: 0,
    };
  }

  return compareFaceDescriptors(liveDescriptor, registeredDescriptor);
}

/**
 * Erases a user's biometric profile (Right to Erasure under Section 12, DPDP Act 2023).
 * Permanently deletes facial biometric profile from biometric_profiles and clears User face status.
 */
export async function eraseBiometricProfile(
  userId: string | mongoose.Types.ObjectId
): Promise<{ success: boolean; erased: boolean }> {
  const uId = typeof userId === "string" ? new mongoose.Types.ObjectId(userId) : userId;

  const res = await BiometricProfile.deleteOne({ userId: uId });

  await User.updateOne(
    { _id: uId },
    {
      $set: {
        isFaceRegistered: false,
        faceRegisteredAt: null,
        faceDescriptor: [],
      },
    }
  );

  return {
    success: true,
    erased: res.deletedCount > 0,
  };
}
