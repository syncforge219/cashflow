import { describe, it, before } from "node:test";
import assert from "node:assert";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom alias loader so @/... imports resolve correctly in Node native ESM
register(pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href, pathToFileURL(process.cwd() + "/"));

// Fake, format-valid GSTIN for a state code; no real registration number is used in tests
const fakeGstin = (stateCode: string) => `${stateCode}AAAAA0000A1Z5`;

describe("Billing tax maths & numbering", () => {
  let tax: any;
  const RATES = { cgstRate: 9, sgstRate: 9, igstRate: 18 };

  before(async () => {
    tax = await import("../src/lib/billingTax");
  });

  it("uses CGST+SGST in the same state, IGST across states, nothing for Non-GST", () => {
    assert.strictEqual(tax.pickTaxMode("GST", "09", "09"), "CGST_SGST");
    assert.strictEqual(tax.pickTaxMode("GST", "09", "27"), "IGST");
    // unknown client state is treated as same-state (intra-state supply)
    assert.strictEqual(tax.pickTaxMode("GST", "09", ""), "CGST_SGST");
    assert.strictEqual(tax.pickTaxMode("NON_GST", "09", "27"), "NONE");
  });

  it("computes 9% + 9% on ₹50,000", () => {
    const t = tax.computeTax(5_000_000, "CGST_SGST", RATES);
    assert.strictEqual(t.cgstPaise, 450_000);
    assert.strictEqual(t.sgstPaise, 450_000);
    assert.strictEqual(t.igstPaise, 0);
    assert.strictEqual(t.taxPaise, 900_000);
    assert.strictEqual(t.totalPaise, 5_900_000);
  });

  it("computes 18% IGST", () => {
    const t = tax.computeTax(5_000_000, "IGST", RATES);
    assert.strictEqual(t.igstPaise, 900_000);
    assert.strictEqual(t.cgstPaise + t.sgstPaise, 0);
    assert.strictEqual(t.totalPaise, 5_900_000);
  });

  it("rounds each tax head to the nearest paisa", () => {
    // ₹333.33 * 9% = ₹29.9997 -> ₹30.00 per head
    const t = tax.computeTax(33_333, "CGST_SGST", RATES);
    assert.strictEqual(t.cgstPaise, 3_000);
    assert.strictEqual(t.sgstPaise, 3_000);
    assert.strictEqual(t.totalPaise, 39_333);
  });

  it("adds no tax for Non-GST", () => {
    const t = tax.computeTax(1_000_000, "NONE", RATES);
    assert.strictEqual(t.taxPaise, 0);
    assert.strictEqual(t.totalPaise, 1_000_000);
  });

  it("classifies registered / unregistered / non-GST sales", () => {
    assert.strictEqual(tax.saleTypeFor("GST", fakeGstin("09")), "REGISTERED");
    assert.strictEqual(tax.saleTypeFor("GST", ""), "UNREGISTERED");
    assert.strictEqual(tax.saleTypeFor("NON_GST", fakeGstin("09")), "NON_GST");
  });

  it("formats document numbers within the 16-character GST limit", () => {
    assert.strictEqual(tax.formatDocNumber("TINV", "2026-27", 7), "TINV/2627/0007");
    const longest = tax.formatDocNumber("ABCDEF", "2026-27", 9999);
    assert.strictEqual(longest, "ABCDEF/2627/9999");
    assert.ok(longest.length <= 16);
  });
});
