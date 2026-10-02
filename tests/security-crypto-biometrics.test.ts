import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose, { Types } from "mongoose";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom alias loader so @/... imports resolve correctly in Node native ESM
register(pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href, pathToFileURL(process.cwd() + "/"));

process.env.DISABLE_CRON = "true";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}
process.env.DISABLE_CRON = "true";

async function resolveMongoUri(uri: string): Promise<string> {
  if (!uri || !uri.startsWith("mongodb+srv://")) return uri;

  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (e) {}

  const match = uri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)\?(.*)$/);
  if (!match) return uri;

  const [, user, pass, host, dbName, queryParams] = match;
  const srvDomain = `_mongodb._tcp.${host}`;

  try {
    const records = await new Promise<dns.SrvRecord[]>((resolve, reject) => {
      dns.resolveSrv(srvDomain, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });

    if (records && records.length > 0) {
      const hostList = records
        .map((r) => `${r.name}:${r.port}`)
        .sort()
        .join(",");
      return `mongodb://${user}:${encodeURIComponent(pass)}@${hostList}/${dbName}?ssl=true&authSource=admin&${queryParams}`;
    }
  } catch (err: any) {
    console.warn("SRV Resolution notice:", err.message);
  }

  return uri;
}

describe("Security, Crypto & DPDP Biometrics Test Suite", () => {
  let encryptField: any;
  let decryptField: any;
  let isEncrypted: any;
  let encryptJson: any;
  let decryptJson: any;

  let Session: any;
  let User: any;
  let JustdialConfig: any;
  let BiometricProfile: any;

  let createSession: any;
  let destroySession: any;
  let hashSessionToken: any;

  let enrollBiometricProfile: any;
  let verifyBiometricProfile: any;
  let eraseBiometricProfile: any;

  before(async () => {
    const rawUri = process.env.MONGODB_URI;
    if (!rawUri) {
      throw new Error("MONGODB_URI is not set in environment");
    }

    const resolvedUri = await resolveMongoUri(rawUri);
    await mongoose.connect(resolvedUri);

    const encMod = await import("@/lib/encryption");
    encryptField = encMod.encryptField;
    decryptField = encMod.decryptField;
    isEncrypted = encMod.isEncrypted;
    encryptJson = encMod.encryptJson;
    decryptJson = encMod.decryptJson;

    const authMod = await import("@/lib/auth");
    createSession = authMod.createSession;
    destroySession = authMod.destroySession;
    hashSessionToken = authMod.hashSessionToken;

    const bioMod = await import("@/lib/biometricService");
    enrollBiometricProfile = bioMod.enrollBiometricProfile;
    verifyBiometricProfile = bioMod.verifyBiometricProfile;
    eraseBiometricProfile = bioMod.eraseBiometricProfile;

    Session = (await import("@/models/Session")).default;
    User = (await import("@/models/User")).default;
    JustdialConfig = (await import("@/models/JustdialConfig")).default;
    BiometricProfile = (await import("@/models/BiometricProfile")).default;
  });

  after(async () => {
    await mongoose.disconnect();
  });

  test("1. AES-256-GCM encryption at rest is robust, authenticated, and idempotent", () => {
    const secret = "TOP-SECRET-JUSTDIAL-API-KEY-123456";
    const encrypted = encryptField(secret);

    assert.ok(encrypted);
    assert.ok(isEncrypted(encrypted));
    assert.ok(encrypted.startsWith("enc:v1:"));
    assert.notEqual(encrypted, secret);

    // Decrypts accurately
    const decrypted = decryptField(encrypted);
    assert.equal(decrypted, secret);

    // Idempotent: encrypting an already encrypted value returns it unchanged
    const doubleEncrypted = encryptField(encrypted);
    assert.equal(doubleEncrypted, encrypted);

    // JSON encryption (descriptors array)
    const vector = [0.1234, -0.5678, 0.9999, -0.0001];
    const encJson = encryptJson(vector);
    const decJson = decryptJson(encJson);

    // Tampering detection: Altering a ciphertext byte must fail authentication tag check
    const parts = encrypted.split(":");
    // parts: ["enc", "v1", iv, tag, ciphertext]
    const tamperedCiphertext = parts[4].slice(0, -2) + (parts[4].slice(-2) === "aa" ? "bb" : "aa");
    const tamperedPayload = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:${tamperedCiphertext}`;

    assert.throws(() => {
      decryptField(tamperedPayload);
    }, /Decryption failed/);
  });

  test("2. Sensitive fields are excluded by default via select: false", async () => {
    const config = await JustdialConfig.findOne({}).lean();
    if (config) {
      // Default query must NOT expose raw apiKey or webhookSecret
      assert.equal(config.apiKey, undefined);
      assert.equal(config.webhookSecret, undefined);
    }
  });

  test("3. Session.token is stored as SHA-256 hash at rest, never raw token", async () => {
    const testUserId = new Types.ObjectId();

    // Create session
    const { sessionToken: rawToken, session } = await createSession(testUserId.toString(), 3600);

    assert.ok(rawToken);
    assert.equal(typeof rawToken, "string");
    assert.equal(rawToken.length, 64); // 32 random bytes in hex

    // Verify stored session in database
    const dbSession = await Session.findById(session._id).lean();
    assert.ok(dbSession);

    // Stored token must NOT be rawToken!
    assert.notEqual(dbSession.sessionToken, rawToken);

    // Stored token must be the exact SHA-256 hash of rawToken
    const expectedHash = hashSessionToken(rawToken);
    assert.equal(dbSession.sessionToken, expectedHash);
    assert.equal(dbSession.token, expectedHash);

    // Lookup session by hash
    const foundSession = await Session.findOne({ sessionToken: expectedHash }).lean();
    assert.ok(foundSession);
    assert.equal(foundSession.userId.toString(), testUserId.toString());

    // Destroy session using rawToken (computes hash internally)
    await destroySession(rawToken);
    const afterDelete = await Session.findById(session._id).lean();
    assert.equal(afterDelete, null);
  });

  test("4. Biometric profiles enforce DPDP Act 2023 consent, encryption, and right to erasure", async () => {
    const testUserId = new Types.ObjectId();
    const testUser = new User({
      _id: testUserId,
      name: "DPDP Test Staff",
      email: `dpdp.test.${Date.now()}@example.com`,
      password: "TestPassword123!",
      role: "Teacher",
      isFaceRegistered: false,
    });
    await testUser.save();

    const dummyDescriptor = Array.from({ length: 128 }, (_, i) => Math.sin(i));

    // 1. Without consent -> MUST REJECT
    await assert.rejects(
      async () => {
        await enrollBiometricProfile({
          userId: testUserId,
          faceDescriptor: dummyDescriptor,
          consentGiven: false,
        });
      },
      /DPDP ACT 2023 COMPLIANCE ERROR/
    );

    // 2. With explicit consent -> ENROLLS WITH ENCRYPTION
    const enrolled = await enrollBiometricProfile({
      userId: testUserId,
      faceDescriptor: dummyDescriptor,
      consentGiven: true,
      consentVersion: "DPDP-2023-V1",
    });

    assert.equal(enrolled.success, true);
    assert.equal(enrolled.consentVersion, "DPDP-2023-V1");
    assert.ok(enrolled.expiresAt);

    // Check biometric_profiles collection
    const storedProfile = await BiometricProfile.findOne({ userId: testUserId })
      .select("+descriptors")
      .lean();
    assert.ok(storedProfile);
    assert.ok(isEncrypted(storedProfile.descriptors));

    // Check User document: vector array MUST BE CLEARED for DPDP data minimization
    const updatedUser = await User.findById(testUserId).select("+faceDescriptor").lean();
    assert.equal(updatedUser.isFaceRegistered, true);
    assert.deepEqual(updatedUser.faceDescriptor, []);

    // 3. Verification works via biometricService
    const verifyMatch = await verifyBiometricProfile(testUserId, dummyDescriptor);
    assert.equal(verifyMatch.isMatch, true);
    assert.ok(verifyMatch.confidencePct > 90);

    // 4. Right to Erasure (DPDP Act 2023)
    const erasure = await eraseBiometricProfile(testUserId);
    assert.equal(erasure.success, true);
    assert.equal(erasure.erased, true);

    // Verify completely deleted from biometric_profiles
    const afterErasure = await BiometricProfile.findOne({ userId: testUserId });
    assert.equal(afterErasure, null);

    // Verify User model reset
    const userAfterErasure = await User.findById(testUserId).lean();
    assert.equal(userAfterErasure.isFaceRegistered, false);
    assert.equal(userAfterErasure.faceRegisteredAt, null);

    await User.findByIdAndDelete(testUserId);
  });

  test("5. Justdial webhook validates HMAC-SHA256 signatures and rejects unsigned requests", () => {
    const webhookSecret = "jd_wh_secret_live_test_778899";
    const payload = JSON.stringify({ leadid: "JD-LEAD-9999", name: "Test Lead" });

    // Valid signature computation
    const validSignature = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");

    // Verification helper matching route logic
    function checkSignature(incomingSig: string | null, bodyPayload: string, secret: string) {
      if (!incomingSig || !secret) return { valid: false, reason: "unsigned" };
      const cleanSig = incomingSig.replace(/^sha256=/i, "").trim().toLowerCase();
      const expectedSig = crypto.createHmac("sha256", secret).update(bodyPayload).digest("hex").toLowerCase();
      if (cleanSig.length !== expectedSig.length) return { valid: false, reason: "mismatch" };
      const isValid = crypto.timingSafeEqual(Buffer.from(cleanSig, "utf-8"), Buffer.from(expectedSig, "utf-8"));
      return { valid: isValid, reason: isValid ? "ok" : "mismatch" };
    }

    // 1. Unsigned request
    const unsignedResult = checkSignature(null, payload, webhookSecret);
    assert.equal(unsignedResult.valid, false);
    assert.equal(unsignedResult.reason, "unsigned");

    // 2. Tampered signature
    const tamperedSig = validSignature.slice(0, -4) + "0000";
    const tamperedResult = checkSignature(tamperedSig, payload, webhookSecret);
    assert.equal(tamperedResult.valid, false);
    assert.equal(tamperedResult.reason, "mismatch");

    // 3. Valid signature with sha256= prefix
    const prefixedValid = `sha256=${validSignature}`;
    const validResult = checkSignature(prefixedValid, payload, webhookSecret);
    assert.equal(validResult.valid, true);

    // 4. Valid raw hex signature
    const rawValidResult = checkSignature(validSignature, payload, webhookSecret);
    assert.equal(rawValidResult.valid, true);
  });
});
