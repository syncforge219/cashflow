import { describe, it, before } from "node:test";
import assert from "node:assert";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom alias loader so @/... imports resolve correctly in Node native ESM
register(pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href, pathToFileURL(process.cwd() + "/"));

// Fake, format-valid GSTIN for a state code; no real registration number is used in tests
const fakeGstin = (stateCode: string) => `${stateCode}AAAAA0000A1Z5`;

describe("Billing master-data rules", () => {
  let billing: any;

  before(async () => {
    billing = await import("../src/lib/billing");
  });

  it("accepts valid GSTINs and reads their state", () => {
    assert.strictEqual(billing.isValidGstin(fakeGstin("09")), true);
    assert.strictEqual(billing.isValidGstin(` ${fakeGstin("09").toLowerCase()} `), true);
    assert.deepStrictEqual(billing.stateFromGstin(fakeGstin("09")), { code: "09", name: "Uttar Pradesh" });
    assert.strictEqual(billing.stateFromGstin(fakeGstin("27")).name, "Maharashtra");
  });

  it("rejects malformed GSTINs and unknown state codes", () => {
    assert.strictEqual(billing.isValidGstin(""), false);
    assert.strictEqual(billing.isValidGstin(fakeGstin("09").slice(0, 14)), false); // 14 chars
    assert.strictEqual(billing.isValidGstin(fakeGstin("09").replace("Z", "X")), false); // 14th char must be Z
    assert.strictEqual(billing.isValidGstin(fakeGstin("99")), false); // no state 99
    assert.strictEqual(billing.isValidGstin("Not Provided"), false);
  });

  it("treats GSTIN placeholders as empty", () => {
    assert.strictEqual(billing.normalizeGstin("Not Provided"), "");
    assert.strictEqual(billing.normalizeGstin("N/A"), "");
    assert.strictEqual(billing.normalizeGstin(null), "");
  });

  it("derives GST type for companies set up before billing existed", () => {
    assert.strictEqual(billing.effectiveGstType({ gst: fakeGstin("09") }), "GST");
    assert.strictEqual(billing.effectiveGstType({ gst: "Not Provided" }), "NON_GST");
    // an explicit choice always wins
    assert.strictEqual(billing.effectiveGstType({ gstType: "NON_GST", gst: fakeGstin("09") }), "NON_GST");
  });

  it("keeps billing day inside every month", () => {
    assert.strictEqual(billing.clampBillingDay(31), 28);
    assert.strictEqual(billing.clampBillingDay(0), 1);
    assert.strictEqual(billing.clampBillingDay("5"), 5);
    assert.strictEqual(billing.clampBillingDay("abc"), 1);
  });

  it("limits billing setup to finance and admin roles", () => {
    for (const role of ["Super Admin", "admin", "Director", "CFO", "Finance Manager", "finance-manager"]) {
      assert.strictEqual(billing.canManageBilling(role), true, role);
    }
    for (const role of ["Counsellor", "Manager", "Finance Executive", "Teacher", "", null]) {
      assert.strictEqual(billing.canManageBilling(role), false, String(role));
    }
  });

  it("masks account numbers to the last four digits", () => {
    assert.strictEqual(billing.maskAccountNumber("4321"), "XXXX4321");
    assert.strictEqual(billing.maskAccountNumber(""), "");
  });
});
