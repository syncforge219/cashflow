import { describe, it, before } from "node:test";
import assert from "node:assert";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom alias loader so @/... imports resolve correctly in Node native ESM
register(pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href, pathToFileURL(process.cwd() + "/"));

describe("Phone Utilities - 12 digit paste & normalization", () => {
  let sanitizePhoneDigits: any;
  let cleanPastedPhone: any;
  let formatPhoneWithPrefix: any;
  let formatPhoneForSubmission: any;

  before(async () => {
    const mod = await import("../src/lib/phoneUtils");
    sanitizePhoneDigits = mod.sanitizePhoneDigits;
    cleanPastedPhone = mod.cleanPastedPhone;
    formatPhoneWithPrefix = mod.formatPhoneWithPrefix;
    formatPhoneForSubmission = mod.formatPhoneForSubmission;
  });

  it("ignores first 2 digits when 12-digit number is passed (user's exact example: 911234567890)", () => {
    assert.strictEqual(sanitizePhoneDigits("911234567890"), "1234567890");
    assert.strictEqual(cleanPastedPhone("911234567890"), "1234567890");
    assert.strictEqual(formatPhoneWithPrefix("911234567890"), "+91 1234567890");
    assert.strictEqual(formatPhoneForSubmission("911234567890"), "+91 1234567890");
  });

  it("handles 12-digit paste into an input that already has '+91 ' prefix", () => {
    assert.strictEqual(sanitizePhoneDigits("+91 911234567890"), "1234567890");
    assert.strictEqual(formatPhoneWithPrefix("+91 911234567890"), "+91 1234567890");
  });

  it("handles 12-digit paste formatted with country code and spaces/hyphens (+91 91123-45678)", () => {
    assert.strictEqual(cleanPastedPhone("+91 91123-456789"), "1123456789");
    assert.strictEqual(cleanPastedPhone("+919112345678"), "9112345678");
  });

  it("handles standard 10-digit number without removing digits", () => {
    assert.strictEqual(sanitizePhoneDigits("9876543210"), "9876543210");
    assert.strictEqual(cleanPastedPhone("9876543210"), "9876543210");
    assert.strictEqual(formatPhoneWithPrefix("9876543210"), "+91 9876543210");
    assert.strictEqual(formatPhoneForSubmission("9876543210"), "+91 9876543210");
  });

  it("handles standard 10-digit number starting with 91 (e.g. 9123456789)", () => {
    assert.strictEqual(sanitizePhoneDigits("9123456789"), "9123456789");
    assert.strictEqual(cleanPastedPhone("9123456789"), "9123456789");
  });

  it("handles 11-digit numbers starting with 0 (e.g. 09876543210)", () => {
    assert.strictEqual(sanitizePhoneDigits("09876543210"), "9876543210");
    assert.strictEqual(cleanPastedPhone("09876543210"), "9876543210");
  });

  it("handles typing progressive digits without shifting", () => {
    assert.strictEqual(sanitizePhoneDigits("+91 9"), "9");
    assert.strictEqual(sanitizePhoneDigits("+91 98"), "98");
    assert.strictEqual(sanitizePhoneDigits("+91 987"), "987");
  });

  it("handles empty or blank inputs cleanly", () => {
    assert.strictEqual(sanitizePhoneDigits(""), "");
    assert.strictEqual(sanitizePhoneDigits("+91 "), "");
    assert.strictEqual(formatPhoneWithPrefix(""), "+91 ");
    assert.strictEqual(formatPhoneForSubmission(""), "");
    assert.strictEqual(formatPhoneForSubmission("+91 "), "");
  });
});
