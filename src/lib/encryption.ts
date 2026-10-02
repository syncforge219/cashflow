import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const PREFIX = "enc:v1:";

/**
 * Derives a 32-byte (256-bit) encryption key from the environment variable.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.FIELD_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

  if (!envKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL SECURITY ERROR: FIELD_ENCRYPTION_KEY environment variable is not defined in production."
      );
    }
    // Safe deterministic development fallback derived from JWT_SECRET or dev passphrase
    const fallback = process.env.JWT_SECRET || "dev-insecure-field-encryption-key-fallback";
    return crypto.createHash("sha256").update(fallback).digest();
  }

  // If 64-char hex string, convert directly to 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(envKey.trim())) {
    return Buffer.from(envKey.trim(), "hex");
  }

  // Otherwise SHA-256 hash to guarantee exactly 32 bytes
  return crypto.createHash("sha256").update(envKey.trim()).digest();
}

/**
 * Checks if a string value is already encrypted with our AES-256-GCM format.
 */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 * Idempotent: If value is already encrypted, returns it unchanged.
 */
export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined) {
    return null;
  }
  const str = String(plaintext);
  if (!str.trim()) {
    return "";
  }
  if (isEncrypted(str)) {
    return str; // Already encrypted
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(str, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${PREFIX}${iv.toString("hex")}:${authTag}:${ciphertext}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * If value is not encrypted, returns value as-is for backward compatibility.
 */
export function decryptField(encryptedValue: string | null | undefined): string | null {
  if (encryptedValue === null || encryptedValue === undefined) {
    return null;
  }
  const str = String(encryptedValue);
  if (!str.trim()) {
    return "";
  }
  if (!isEncrypted(str)) {
    return str; // Plaintext legacy fallback
  }

  try {
    const payload = str.slice(PREFIX.length);
    const [ivHex, tagHex, ciphertextHex] = payload.split(":");

    if (!ivHex || !tagHex || !ciphertextHex) {
      throw new Error("Malformed encrypted field payload");
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(tagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error: any) {
    console.error("Failed to decrypt field:", error.message);
    throw new Error(`Decryption failed: integrity check or key mismatch.`);
  }
}

/**
 * Encrypts arbitrary JSON-serializable data (e.g., face descriptors vector array).
 */
export function encryptJson(data: any): string | null {
  if (data === null || data === undefined) return null;
  return encryptField(JSON.stringify(data));
}

/**
 * Decrypts AES-256-GCM encrypted JSON data.
 */
export function decryptJson<T = any>(encryptedValue: string | null | undefined): T | null {
  if (encryptedValue === null || encryptedValue === undefined) return null;
  const decryptedStr = decryptField(encryptedValue);
  if (!decryptedStr) return null;
  try {
    return JSON.parse(decryptedStr) as T;
  } catch (err: any) {
    console.error("Failed to parse decrypted JSON:", err.message);
    return null;
  }
}
