import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";

register(
  pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href,
  pathToFileURL(process.cwd() + "/")
);
process.env.DISABLE_CRON = "true";
process.env.FIELD_ENCRYPTION_KEY = "e".repeat(64);

/**
 * Reproduces the Executive Dashboard bug: picking a brand showed that brand's all-time
 * collection as "Today's" and "Period" collection, because the brand's { $or } replaced the
 * date { $or } in the Mongo filters.
 */
describe("Executive dashboard with a brand selected", () => {
  let mongod: MongoMemoryServer;
  let stats: any;
  let comparison: any;
  let dates: typeof import("../src/lib/dates");
  let today: string;
  let monthFirst: string;

  let seq = 0;
  const uid = (prefix: string) => `${prefix}-${++seq}`;
  const db = () => mongoose.connection.collection.bind(mongoose.connection);

  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("dashboard_test");
    dates = await import("../src/lib/dates");
    stats = await import("../src/app/api/admin-dashboard/stats/route");
    comparison = await import("../src/app/api/admin-dashboard/comparison/route");
    await (await import("../src/lib/db")).default();

    today = dates.todayKey();
    monthFirst = dates.monthBoundsKey(today).first;
    const lastMonth = dates.addDaysKey(monthFirst, -5);
    const at = (key: string) => dates.dateKeyToDate(key);

    const [dg, cm] = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    await db()("brands").insertMany([
      { _id: dg, brandId: "BR-DG", name: "DESIGN GATEWAY", code: "DG", isDeleted: false },
      { _id: cm, brandId: "BR-CM", name: "CADD MANTRA", code: "CM", isDeleted: false },
    ]);

    const adm = (brandId: any, brand: string, day: string) => ({
      _id: new mongoose.Types.ObjectId(),
      admissionId: uid("ADM"),
      fullName: `${brand} ${day}`,
      brand,
      brandId,
      finalFee: 50000,
      admissionDate: at(day),
      createdAt: at(day),
      isDeleted: false,
    });
    // DESIGN GATEWAY: one admission last month, one today. CADD MANTRA: one today.
    const dgOld = adm(dg, "DESIGN GATEWAY", lastMonth);
    const dgNew = adm(dg, "DESIGN GATEWAY", today);
    const cmNew = adm(cm, "CADD MANTRA", today);
    await db()("admissions").insertMany([dgOld, dgNew, cmNew]);

    const pay = (a: any, amount: number, day: string) => ({
      admissionId: a._id,
      receiptNo: uid("REC"),
      studentName: a.fullName,
      amountReceived: amount,
      paymentMode: "Cash",
      brand: a.brand,
      brandId: a.brandId,
      paymentDate: at(day),
      createdAt: at(day),
      isDeleted: false,
    });
    await db()("payments").insertMany([
      pay(dgOld, 900000, lastMonth), // big old payment that used to leak into "today"
      pay(dgNew, 10000, today),
      pay(cmNew, 7000, today),
    ]);

    await db()("enquiries").insertMany([
      { enquiryId: uid("ENQ"), studentFullName: "DG lead old", targetBrand: "DESIGN GATEWAY", targetBrandId: dg, createdAt: at(lastMonth), isDeleted: false },
      { enquiryId: uid("ENQ"), studentFullName: "DG lead 1", targetBrand: "DESIGN GATEWAY", targetBrandId: dg, createdAt: at(today), isDeleted: false },
      { enquiryId: uid("ENQ"), studentFullName: "DG lead 2", targetBrand: "DESIGN GATEWAY", targetBrandId: dg, createdAt: at(today), isDeleted: false },
      { enquiryId: uid("ENQ"), studentFullName: "CM lead", targetBrand: "CADD MANTRA", targetBrandId: cm, createdAt: at(today), isDeleted: false },
    ]);

    await db()("expenses").insertMany([
      { expenseId: uid("EXP"), title: "Old rent", category: "Rent", amount: 50000, brand: "DESIGN GATEWAY", brandId: dg, expenseDate: at(lastMonth), isDeleted: false },
      { expenseId: uid("EXP"), title: "Ads", category: "Marketing", amount: 2000, brand: "DESIGN GATEWAY", brandId: dg, expenseDate: at(today), isDeleted: false },
    ]);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  const getStats = async (brand: string) => {
    const url = `http://localhost/api/admin-dashboard/stats?startDate=${monthFirst}&endDate=${today}&brand=${encodeURIComponent(brand)}`;
    const json = await (await stats.GET(new Request(url))).json();
    assert.equal(json.success, true, JSON.stringify(json).slice(0, 300));
    return json.data;
  };

  test("collections, admissions and leads respect the month when a brand is selected", async () => {
    const d = await getStats("DESIGN GATEWAY");
    assert.equal(d.financialSummary.collections, 10000, "period collection excludes last month's ₹9,00,000");
    assert.equal(d.kpis.todayCollection, "₹10,000", "today's collection is today only");
    assert.equal(d.kpis.admissionsTotal, 1);
    assert.equal(d.kpis.totalLeads, 2);
    assert.equal(d.kpis.conversionRate, "50.0%");
    assert.equal(d.financialSummary.expenses, 2000, "period expenses exclude last month's rent");
  });

  test("other brand and All Brands are unaffected", async () => {
    const cm = await getStats("CADD MANTRA");
    assert.equal(cm.financialSummary.collections, 7000);
    assert.equal(cm.kpis.todayCollection, "₹7,000");

    const all = await getStats("All Brands");
    assert.equal(all.financialSummary.collections, 17000);
    assert.equal(all.kpis.admissionsTotal, 2);
  });

  test("period comparison counts money on the day it was received, per brand", async () => {
    const url = "http://localhost/api/admin-dashboard/comparison?preset=this_month_vs_last_month&brand=DESIGN%20GATEWAY";
    const json = await (await comparison.GET(new Request(url))).json();
    assert.equal(json.success, true, JSON.stringify(json).slice(0, 300));
    const text = JSON.stringify(json.data);
    assert.ok(text.includes("10000"), "this month: ₹10,000");
    assert.ok(text.includes("900000"), "last month: ₹9,00,000");
    assert.ok(!text.includes("907000") && !text.includes("910000"), "periods and brands are not mixed");
  });
});
