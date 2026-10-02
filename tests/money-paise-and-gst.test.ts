import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
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

describe("Money Paise & GST Line-Item Rounding Test Suite", () => {
  let Admission: any;
  let Payment: any;
  let toPaise: any;
  let fromPaise: any;
  let formatINR: any;
  let hasFractionalPaise: any;
  let calculateLineItemGst: any;
  let calculateDocumentTotals: any;
  let getStudentBalance: any;
  let recomputeAndStoreAdmissionBalance: any;

  before(async () => {
    const rawUri = process.env.MONGODB_URI;
    if (!rawUri) {
      throw new Error("MONGODB_URI is not set in environment");
    }

    const resolvedUri = await resolveMongoUri(rawUri);
    await mongoose.connect(resolvedUri);

    const moneyMod = await import("@/lib/money");
    toPaise = moneyMod.toPaise;
    fromPaise = moneyMod.fromPaise;
    formatINR = moneyMod.formatINR;
    hasFractionalPaise = moneyMod.hasFractionalPaise;
    calculateLineItemGst = moneyMod.calculateLineItemGst;
    calculateDocumentTotals = moneyMod.calculateDocumentTotals;

    const balanceMod = await import("@/lib/studentBalanceService");
    getStudentBalance = balanceMod.getStudentBalance;
    recomputeAndStoreAdmissionBalance = balanceMod.recomputeAndStoreAdmissionBalance;

    const admMod = await import("@/models/Admission");
    Admission = admMod.default;

    const payMod = await import("@/models/Payment");
    Payment = payMod.default;
  });

  after(async () => {
    await mongoose.disconnect();
  });

  test("1. Shared money utilities convert correctly between rupees and paise", () => {
    // toPaise
    assert.equal(toPaise(100), 10000);
    assert.equal(toPaise(99.99), 9999);
    assert.equal(toPaise("1500.50"), 150050);
    assert.equal(toPaise("₹ 25,000.75"), 2500075);
    assert.equal(toPaise(0), 0);
    assert.equal(toPaise(null), 0);
    assert.equal(toPaise(undefined), 0);

    // fromPaise
    assert.equal(fromPaise(10000), 100);
    assert.equal(fromPaise(9999), 99.99);
    assert.equal(fromPaise(0), 0);
    assert.equal(fromPaise(null), 0);

    // formatINR
    const formatted = formatINR(10000000); // ₹1,00,000
    assert.match(formatted, /1,00,000/);

    // hasFractionalPaise
    assert.equal(hasFractionalPaise(100), false);
    assert.equal(hasFractionalPaise(100.5), false);
    assert.equal(hasFractionalPaise(100.55), false);
    assert.equal(hasFractionalPaise(100.555), true);
    assert.equal(hasFractionalPaise(99.9999), true);
  });

  test("2. GST calculations round per line item consistently", () => {
    // Item 1: quantity 1, rate ₹99.55 (9955 paise), 18% GST
    // Taxable: 9955 paise
    // GST: Math.round(9955 * 0.18) = Math.round(1791.9) = 1792 paise (₹17.92)
    // Total: 9955 + 1792 = 11747 paise (₹117.47)
    const line1 = calculateLineItemGst(1, 9955, 18);
    assert.equal(line1.taxableAmountPaise, 9955);
    assert.equal(line1.gstAmountPaise, 1792);
    assert.equal(line1.totalAmountPaise, 11747);
    assert.equal(line1.gstAmountRupees, 17.92);

    // Item 2: quantity 3, rate ₹33.33 (3333 paise), 18% GST
    // Taxable: 3 * 3333 = 9999 paise (₹99.99)
    // GST: Math.round(9999 * 0.18) = Math.round(1799.82) = 1800 paise (₹18.00)
    // Total: 9999 + 1800 = 11799 paise (₹117.99)
    const line2 = calculateLineItemGst(3, 3333, 18);
    assert.equal(line2.taxableAmountPaise, 9999);
    assert.equal(line2.gstAmountPaise, 1800);
    assert.equal(line2.totalAmountPaise, 11799);

    // Item 3: quantity 2.5, rate ₹100.00 (10000 paise), 5% GST
    // Taxable: 25000 paise
    // GST: Math.round(25000 * 0.05) = 1250 paise
    // Total: 26250 paise
    const line3 = calculateLineItemGst(2.5, 10000, 5);
    assert.equal(line3.taxableAmountPaise, 25000);
    assert.equal(line3.gstAmountPaise, 1250);
    assert.equal(line3.totalAmountPaise, 26250);

    // Document totals with 2 items, discount, transport
    const docTotals = calculateDocumentTotals({
      items: [
        { quantity: 1, ratePaise: 9955, gstRate: 18 }, // Taxable 9955, GST 1792
        { quantity: 3, ratePaise: 3333, gstRate: 18 }, // Taxable 9999, GST 1800
      ],
      discountPaise: 1000, // ₹10.00 discount
      transportChargesPaise: 500, // ₹5.00 transport
      additionalChargesPaise: 250, // ₹2.50 additional
    });

    // Subtotal: 9955 + 9999 = 19954 paise
    assert.equal(docTotals.subtotalPaise, 19954);
    // GST: 1792 + 1800 = 3592 paise
    assert.equal(docTotals.gstAmountPaise, 3592);
    // Grand Total: 19954 - 1000 + 3592 + 500 + 250 = 23296 paise (₹232.96)
    assert.equal(docTotals.grandTotalPaise, 23296);
    assert.equal(docTotals.grandTotal, 232.96);
  });

  test("3. Admission dual-write synchronizes rupees <-> paise in both directions", async () => {
    const testAdmId = new Types.ObjectId();

    // 1. Write with rupee values -> auto-generates *Paise
    const admission = new Admission({
      _id: testAdmId,
      fullName: "Test Paise Student",
      mobileNumber: "9876543210",
      courseFee: 45000.50,
      discountAmount: 5000.50,
      finalFee: 40000,
      registrationAmount: 10000,
      remainingBalance: 30000,
    });
    await admission.save();

    const saved = await Admission.findById(testAdmId).lean();
    assert.equal(saved.courseFeePaise, 4500050);
    assert.equal(saved.discountAmountPaise, 500050);
    assert.equal(saved.finalFeePaise, 4000000);
    assert.equal(saved.registrationAmountPaise, 1000000);
    assert.equal(saved.remainingBalancePaise, 3000000);

    // 2. Update with *Paise value -> auto-synchronizes rupee value
    await Admission.updateOne(
      { _id: testAdmId },
      { $set: { remainingBalancePaise: 1500050 } }
    );
    const updated = await Admission.findById(testAdmId).lean();
    assert.equal(updated.remainingBalancePaise, 1500050);
    assert.equal(updated.remainingBalance, 15000.50);

    // Clean up
    await Admission.findByIdAndDelete(testAdmId);
  });

  test("4. Payment dual-write synchronizes amountReceived <-> amountReceivedPaise", async () => {
    const testPayId = new Types.ObjectId();
    const testAdmId = new Types.ObjectId();

    // 1. Write with rupee value -> auto-generates amountReceivedPaise
    const payment = new Payment({
      _id: testPayId,
      admissionId: testAdmId,
      studentName: "Test Student",
      amountReceived: 12500.75,
      paymentMode: "UPI",
    });
    await payment.save();

    const saved = await Payment.findById(testPayId).lean();
    assert.equal(saved.amountReceivedPaise, 1250075);
    assert.equal(saved.amountReceived, 12500.75);

    // 2. Update with *Paise value -> auto-synchronizes rupee value
    await Payment.updateOne(
      { _id: testPayId },
      { $set: { amountReceivedPaise: 2000000 } }
    );
    const updated = await Payment.findById(testPayId).lean();
    assert.equal(updated.amountReceivedPaise, 2000000);
    assert.equal(updated.amountReceived, 20000);

    // Clean up
    await Payment.findByIdAndDelete(testPayId);
  });

  test("5. getStudentBalance & recomputeAndStoreAdmissionBalance operate in exact integer paise", async () => {
    const testAdmId = new Types.ObjectId();
    const testPay1Id = new Types.ObjectId();
    const testPay2Id = new Types.ObjectId();

    // Create admission with finalFee: ₹35,000.50 (3500050 paise)
    const admission = new Admission({
      _id: testAdmId,
      fullName: "Exact Paise Balance Test",
      mobileNumber: "9123456780",
      finalFee: 35000.50,
      remainingBalance: 35000.50,
    });
    await admission.save();

    // Payment 1: ₹10,000.25 (1000025 paise)
    const pay1 = new Payment({
      _id: testPay1Id,
      admissionId: testAdmId,
      studentName: "Exact Paise Balance Test",
      amountReceived: 10000.25,
      paymentMode: "Bank Transfer",
    });
    await pay1.save();

    // Payment 2: ₹5,000.25 (500025 paise)
    const pay2 = new Payment({
      _id: testPay2Id,
      admissionId: testAdmId,
      studentName: "Exact Paise Balance Test",
      amountReceived: 5000.25,
      paymentMode: "UPI",
    });
    await pay2.save();

    // Recompute balance
    const result = await recomputeAndStoreAdmissionBalance(testAdmId);

    // Final fee: 3500050 paise
    // Total paid: 1000025 + 500025 = 1500050 paise (₹15,000.50)
    // Remaining balance: 3500050 - 1500050 = 2000000 paise (₹20,000)
    assert.equal(result.finalFeePaise, 3500050);
    assert.equal(result.totalPaidPaise, 1500050);
    assert.equal(result.remainingBalancePaise, 2000000);
    assert.equal(result.finalFee, 35000.50);
    assert.equal(result.totalPaid, 15000.50);
    assert.equal(result.remainingBalance, 20000);

    // Verify stored Admission document
    const updatedAdm = await Admission.findById(testAdmId).lean();
    assert.equal(updatedAdm.remainingBalancePaise, 2000000);
    assert.equal(updatedAdm.remainingBalance, 20000);
    assert.equal(updatedAdm.amountReceivedTodayPaise, 1500050);
    assert.equal(updatedAdm.amountReceivedToday, 15000.50);

    // Clean up
    await Payment.deleteMany({ admissionId: testAdmId });
    await Admission.findByIdAndDelete(testAdmId);
  });
});
