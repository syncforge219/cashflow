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
process.env.FIELD_ENCRYPTION_KEY = "c".repeat(64);

// Block all outbound calls (WhatsApp / email helpers have hard-coded fallbacks)
const outboundCalls: string[] = [];
globalThis.fetch = (async (input: any) => {
  outboundCalls.push(String(input?.url ?? input));
  throw new Error("Outbound network disabled in tests");
}) as any;

let dates: typeof import("../src/lib/dates");
let fees: typeof import("../src/lib/feeSchedule");

before(async () => {
  dates = await import("../src/lib/dates");
  fees = await import("../src/lib/feeSchedule");
});

// Runs `fn` with the process time zone set to each value: results must not depend on it
function inEveryTimeZone(fn: () => void) {
  const original = process.env.TZ;
  try {
    for (const tz of ["UTC", "Asia/Kolkata", "America/New_York"]) {
      process.env.TZ = tz;
      fn();
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
}

describe("IST date helpers", () => {
  test("stored dates read as the right IST calendar day, in any server time zone", () => {
    inEveryTimeZone(() => {
      // Date-only value stored as UTC midnight (what new Date("2026-10-05") produces)
      assert.equal(dates.toDateKey(new Date("2026-10-05T00:00:00.000Z")), "2026-10-05");
      // Date-only value stored as IST midnight (what new Date(y, m, d) on an IST browser produces)
      assert.equal(dates.toDateKey(new Date("2026-10-04T18:30:00.000Z")), "2026-10-05");
      // Payment at 01:30 IST on 6 Oct: toISOString() says 5 Oct, which was the bug
      const early = new Date("2026-10-05T20:00:00.000Z");
      assert.equal(early.toISOString().slice(0, 10), "2026-10-05");
      assert.equal(dates.toDateKey(early), "2026-10-06");
      // Plain keys and datetime-local strings pass through untouched
      assert.equal(dates.toDateKey("2026-02-28"), "2026-02-28");
      assert.equal(dates.toDateKey("2026-02-28T09:15"), "2026-02-28");
      assert.equal(dates.toDateKey("not a date"), "");
      assert.equal(dates.toDateKey(null), "");
    });
  });

  test("formatDate never shifts the day", () => {
    inEveryTimeZone(() => {
      assert.equal(dates.formatDate("2026-10-05"), "05 Oct 2026");
      assert.equal(dates.formatDate(new Date("2026-10-04T18:30:00.000Z")), "05 Oct 2026");
      assert.equal(dates.formatDate(new Date("2026-10-05T20:00:00.000Z"), "short"), "06/10/2026");
      assert.equal(dates.formatDate(undefined), "—");
    });
  });

  test("IST day ranges cover the whole Indian day, including UTC-midnight stored values", () => {
    const { start, end } = dates.istDayRange("2026-10-05");
    assert.equal(start.toISOString(), "2026-10-04T18:30:00.000Z");
    assert.equal(end.toISOString(), "2026-10-05T18:29:59.999Z");
    const inRange = (d: Date) => d >= start && d <= end;
    assert.ok(inRange(new Date("2026-10-05T00:00:00.000Z"))); // UTC-midnight date-only
    assert.ok(inRange(new Date("2026-10-04T18:30:00.000Z"))); // IST-midnight date-only
    assert.ok(inRange(new Date("2026-10-04T19:00:00.000Z"))); // 00:30 IST payment
    assert.ok(!inRange(new Date("2026-10-05T18:30:00.000Z"))); // 00:00 IST next day
  });

  test("WhatsApp date formatter reads Indian d/m/yyyy correctly (was read as m/d)", async () => {
    const { formatDateOnly } = await import("../src/lib/msg91");
    inEveryTimeZone(() => {
      assert.equal(formatDateOnly("5/10/2026"), "05 Oct 2026"); // used to come out as 10 May
      assert.equal(formatDateOnly("25/12/2026"), "25 Dec 2026"); // used to be returned unformatted
      assert.equal(formatDateOnly("2026-10-05"), "05 Oct 2026");
      assert.equal(formatDateOnly("2026-10-05T20:00:00.000Z"), "06 Oct 2026"); // 01:30 IST next day
      assert.equal(formatDateOnly("21 Jul 2026, 05:30 am"), "21 Jul 2026");
    });
  });

  test("month arithmetic clamps to month end", () => {
    assert.equal(dates.addMonthsKey("2026-01-31", 1), "2026-02-28");
    assert.equal(dates.addMonthsKey("2028-01-31", 1), "2028-02-29");
    assert.equal(dates.addMonthsKey("2026-08-31", 1), "2026-09-30");
    assert.equal(dates.addMonthsKey("2026-11-15", 3), "2027-02-15");
    assert.equal(dates.daysBetween("2026-10-05", "2026-10-01"), -4);
    assert.deepEqual(dates.monthBoundsKey("2026-02-10"), { first: "2026-02-01", last: "2026-02-28" });
  });
});

describe("Fee schedule", () => {
  const TODAY = "2026-10-05";
  const base = {
    finalFee: 40000,
    registrationAmount: 5000,
    downpaymentAmount: 5000,
    admissionDate: "2026-08-01",
    downpaymentDueDate: "2026-08-15",
    hasEmi: true,
    numInstallments: 3,
    customEmiPlan: [
      { dueDate: "2026-09-01", amount: 10000 },
      { dueDate: "2026-10-01", amount: 10000 },
      { dueDate: "2026-11-01", amount: 10000 },
    ],
  };

  test("pays instalments in order and reports what is overdue", () => {
    // Paid registration + down payment + 3,000 towards EMI 1
    const s = fees.buildFeeSchedule(base, { totalPaid: 13000 }, TODAY);
    assert.deepEqual(
      s.items.map((i) => [i.kind, i.dueDateKey, i.dueAmount, i.status]),
      [
        ["REGISTRATION", "2026-08-01", 0, "PAID"],
        ["DOWNPAYMENT", "2026-08-15", 0, "PAID"],
        ["EMI", "2026-09-01", 7000, "OVERDUE"],
        ["EMI", "2026-10-01", 10000, "OVERDUE"],
        ["EMI", "2026-11-01", 10000, "UPCOMING"],
      ]
    );
    assert.equal(s.items[2].partiallyPaid, true);
    assert.equal(s.outstanding, 27000);
    assert.equal(s.overdueAmount, 17000);
    assert.equal(s.amountDueNow, 17000);
    assert.equal(s.nextDue?.dueDateKey, "2026-09-01");
    assert.equal(s.daysToNextDue, -34);

    const aging = fees.agingOf(s)!;
    assert.equal(aging.bucket, "overdue31to60");
    assert.equal(aging.amount, 17000);
    assert.equal(aging.label, "34 Days Overdue");
  });

  test("registration/down-payment money is not credited to EMIs (old pending-list bug)", () => {
    // Only registration paid: down payment is the overdue item, EMI 1 is not "partly paid"
    const s = fees.buildFeeSchedule(base, { totalPaid: 5000 }, TODAY);
    const dp = s.items.find((i) => i.kind === "DOWNPAYMENT")!;
    const emi1 = s.items.find((i) => i.kind === "EMI")!;
    assert.equal(dp.dueAmount, 5000);
    assert.equal(emi1.dueAmount, 10000);
    assert.equal(emi1.partiallyPaid, false);
    assert.equal(s.nextDue?.kind, "DOWNPAYMENT");
  });

  test("older records whose instalment amount was reduced on partial payment give the same answer", () => {
    const mutated = {
      ...base,
      customEmiPlan: [
        { dueDate: "2026-09-01", amount: 7000 }, // was reduced from 10,000 after a 3,000 payment
        { dueDate: "2026-10-01", amount: 10000 },
        { dueDate: "2026-11-01", amount: 10000 },
      ],
    };
    const correct = fees.buildFeeSchedule(base, { totalPaid: 13000 }, TODAY);
    const legacy = fees.buildFeeSchedule(mutated, { totalPaid: 13000 }, TODAY);
    assert.deepEqual(
      legacy.items.map((i) => i.dueAmount),
      correct.items.map((i) => i.dueAmount)
    );
    assert.equal(legacy.overdueAmount, correct.overdueAmount);
  });

  test("generated EMI plans (no custom plan) are scheduled monthly from admission, clamped to month end", () => {
    const s = fees.buildFeeSchedule(
      { finalFee: 31000, registrationAmount: 1000, admissionDate: "2026-01-31", hasEmi: true, numInstallments: 3 },
      { totalPaid: 1000 },
      "2026-02-10"
    );
    const emis = s.items.filter((i) => i.kind === "EMI");
    assert.deepEqual(emis.map((i) => i.dueDateKey), ["2026-02-28", "2026-03-31", "2026-04-30"]);
    assert.deepEqual(emis.map((i) => i.amount), [10000, 10000, 10000]);
    // Before: a student like this showed as overdue for the full 30,000 from admission day
    assert.equal(s.overdueAmount, 0);
    assert.equal(fees.agingOf(s)!.bucket, "next30Days");
  });

  test("no plan: balance is due 30 days after admission", () => {
    const s = fees.buildFeeSchedule({ finalFee: 20000, admissionDate: "2026-09-20" }, { totalPaid: 5000 }, TODAY);
    assert.equal(s.items.length, 1);
    assert.equal(s.items[0].dueDateKey, "2026-10-20");
    assert.equal(s.items[0].dueAmount, 15000);
    assert.equal(fees.agingOf(s)!.bucket, "next15Days");
  });

  test("fully paid / overpaid students have nothing due", () => {
    const s = fees.buildFeeSchedule(base, { totalPaid: 45000 }, TODAY);
    assert.equal(s.outstanding, 0);
    assert.equal(s.nextDue, null);
    assert.equal(fees.agingOf(s), null);
  });

  test("debt not covered by any instalment is still collected (with the last instalment)", () => {
    // Plan covers 20,000 of a 40,000 fee; 10,000 paid -> 30,000 outstanding
    const s = fees.buildFeeSchedule(
      { ...base, customEmiPlan: [{ dueDate: "2026-09-01", amount: 10000 }] },
      { totalPaid: 10000 },
      TODAY
    );
    const extra = s.items[s.items.length - 1];
    assert.equal(extra.label, "Unscheduled Balance");
    assert.equal(extra.dueDateKey, "2026-09-01");
    assert.equal(extra.dueAmount, 10000);
    assert.equal(s.outstanding, 30000);
    // Nothing is lost: the dues across the schedule add up to the outstanding balance
    assert.equal(s.items.reduce((sum, i) => sum + i.dueAmount, 0), 30000);
  });

  test("bucket boundaries", () => {
    const at = (due: string) =>
      fees.agingOf(fees.buildFeeSchedule({ finalFee: 100, customEmiPlan: [{ dueDate: due, amount: 100 }], admissionDate: "2026-01-01" }, { totalPaid: 0 }, TODAY))!.bucket;
    assert.equal(at("2026-10-04"), "overdue1to30");
    assert.equal(at("2026-09-05"), "overdue1to30"); // 30 days
    assert.equal(at("2026-09-04"), "overdue31to60");
    assert.equal(at("2026-08-06"), "overdue31to60"); // 60 days
    assert.equal(at("2026-07-07"), "overdue61to90"); // 90 days
    assert.equal(at("2026-07-06"), "overdue90Plus");
    assert.equal(at("2026-10-05"), "dueToday");
    assert.equal(at("2026-10-12"), "next7Days");
    assert.equal(at("2026-10-20"), "next15Days");
    assert.equal(at("2026-11-04"), "next30Days");
    assert.equal(at("2026-11-05"), "later");
  });

  test("paid flags follow the money; amounts are never touched", () => {
    const plan = base.customEmiPlan.map((e) => ({ ...e, isPaid: false as boolean, paidDate: null as any }));
    const paidOn = new Date("2026-10-05T06:00:00Z");
    fees.syncCustomPlanFlags(plan, fees.buildFeeSchedule({ ...base, customEmiPlan: plan }, { totalPaid: 20000 }, TODAY), paidOn);
    assert.deepEqual(plan.map((p) => p.isPaid), [true, false, false]);
    assert.equal(plan[0].paidDate, paidOn);
    assert.deepEqual(plan.map((p) => p.amount), [10000, 10000, 10000]);

    // Payment deleted -> flag cleared
    fees.syncCustomPlanFlags(plan, fees.buildFeeSchedule({ ...base, customEmiPlan: plan }, { totalPaid: 15000 }, TODAY));
    assert.deepEqual(plan.map((p) => p.isPaid), [false, false, false]);
    assert.equal(plan[0].paidDate, null);
  });
});

describe("Payments API + balances (in-memory MongoDB)", () => {
  let mongod: MongoMemoryServer;
  let payments: any;
  let reports: any;
  let Admission: any;
  let Payment: any;
  let studentBalanceLookupStages: any;
  let admissionId: string;

  const addDays = (key: string, n: number) => dates.addDaysKey(key, n);

  const post = async (body: any) => {
    const res = await payments.POST(
      new Request("http://localhost/api/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ admissionId, paymentMode: "Cash", ...body }),
      })
    );
    return { status: res.status, json: await res.json() };
  };

  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("collections_test");
    payments = await import("../src/app/api/payments/route");
    reports = await import("../src/app/api/reports/collections/route");
    Admission = (await import("../src/models/Admission")).default;
    Payment = (await import("../src/models/Payment")).default;
    ({ studentBalanceLookupStages } = await import("../src/lib/studentBalanceService"));
    await (await import("../src/lib/db")).default();

    const today = dates.todayKey();
    const admission = await Admission.create({
      fullName: "Test Student",
      course: "AutoCAD",
      brand: "CADD MANTRA",
      finalFee: 40000,
      registrationAmount: 5000,
      downpaymentAmount: 5000,
      admissionDate: dates.dateKeyToDate(addDays(today, -40)),
      downpaymentDueDate: dates.dateKeyToDate(addDays(today, -20)),
      hasEmi: true,
      numInstallments: 3,
      customEmiPlan: [
        { dueDate: dates.dateKeyToDate(addDays(today, -5)), amount: 10000 },
        { dueDate: dates.dateKeyToDate(addDays(today, 25)), amount: 10000 },
        { dueDate: dates.dateKeyToDate(addDays(today, 55)), amount: 10000 },
      ],
      remainingBalance: 40000,
    });
    admissionId = admission._id.toString();
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("the received date picked in the form is stored as that IST day", async () => {
    const day = addDays(dates.todayKey(), -40);
    const { status, json } = await post({ amountReceived: 5000, paymentDate: day, remarks: "Registration" });
    assert.equal(status, 201, JSON.stringify(json));
    const saved = await Payment.findById(json.data._id).lean();
    assert.equal(dates.toDateKey(saved.paymentDate), day);
  });

  test("future dates and non-positive amounts are rejected", async () => {
    assert.equal((await post({ amountReceived: 100, paymentDate: addDays(dates.todayKey(), 1) })).status, 400);
    assert.equal((await post({ amountReceived: -5 })).status, 400);
    assert.equal((await post({ amountReceived: 100, paymentDate: "31/02/2026" })).status, 400);
  });

  test("a down payment does not inflate the agreed down payment, and partial EMI payments do not rewrite the plan", async () => {
    await post({ amountReceived: 5000, isDownpayment: true, remarks: "Down Payment" });
    let adm = await Admission.findById(admissionId).lean();
    assert.equal(adm.downpaymentAmount, 5000, "agreed down payment unchanged");
    assert.equal(adm.remainingBalance, 30000);

    await post({ amountReceived: 3000 });
    adm = await Admission.findById(admissionId).lean();
    assert.deepEqual(adm.customEmiPlan.map((e: any) => e.amount), [10000, 10000, 10000]);
    assert.deepEqual(adm.customEmiPlan.map((e: any) => e.isPaid), [false, false, false]);

    const receivedOn = addDays(dates.todayKey(), -1);
    await post({ amountReceived: 7000, paymentDate: receivedOn });
    adm = await Admission.findById(admissionId).lean();
    assert.deepEqual(adm.customEmiPlan.map((e: any) => e.isPaid), [true, false, false]);
    assert.equal(dates.toDateKey(adm.customEmiPlan[0].paidDate), receivedOn);
    assert.equal(adm.remainingBalance, 20000);
  });

  test("deleted payments no longer count as paid in list balances", async () => {
    const balanceOf = async () => {
      const [row] = await Admission.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(admissionId) } },
        ...studentBalanceLookupStages(),
      ]);
      return row.remainingBalance;
    };
    assert.equal(await balanceOf(), 20000);
    const last = await Payment.findOne({ admissionId, amountReceived: 7000 });
    last.isDeleted = true;
    await last.save();
    assert.equal(await balanceOf(), 27000);
  });

  test("GET filters by IST day and lists newest payment date first", async () => {
    const day = addDays(dates.todayKey(), -40);
    const res = await payments.GET(new Request(`http://localhost/api/payments?startDate=${day}&endDate=${day}`));
    const json = await res.json();
    assert.equal(json.success, true, JSON.stringify(json));
    assert.deepEqual(json.data.map((p: any) => p.amountReceived), [5000]);

    const all = await (await payments.GET(new Request(`http://localhost/api/payments?admissionId=${admissionId}`))).json();
    const keys = all.data.map((p: any) => dates.toDateKey(p.paymentDate));
    assert.deepEqual(keys, [...keys].sort().reverse());
  });

  test("GET no longer rewrites payment amounts", async () => {
    // Old GET "reconciled" a single payment equal to registration + down payment down to registration only
    const adm = await Admission.create({ fullName: "Paid Both", finalFee: 20000, registrationAmount: 2000, downpaymentAmount: 3000 });
    const p = await Payment.create({ admissionId: adm._id, studentName: "Paid Both", amountReceived: 5000, paymentMode: "Cash" });
    await payments.GET(new Request("http://localhost/api/payments"));
    assert.equal((await Payment.findById(p._id).lean()).amountReceived, 5000);
  });

  test("collections report filters by the payment's company name", async () => {
    const res = await reports.GET(new Request(`http://localhost/api/reports/collections?company=Cash`) as any);
    const json = await res.json();
    assert.equal(json.success, true, JSON.stringify(json));
    assert.ok(json.data.length > 0, "Cash payments found via the company field");
    assert.ok(json.data.every((p: any) => p.company === "Cash"));
  });

  test("no outbound calls were made", () => {
    assert.deepEqual(outboundCalls, []);
  });
});
