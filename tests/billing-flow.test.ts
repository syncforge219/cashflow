// Run with: node --test --experimental-test-module-mocks tests/billing-flow.test.ts
import { test, describe, before, after, mock } from "node:test";
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

// Fake, format-valid GSTIN for a state code; no real registration number is used in tests
const fakeGstin = (stateCode: string) => `${stateCode}AAAAA0000A1Z5`;
process.env.DISABLE_CRON = "true";
process.env.FIELD_ENCRYPTION_KEY = "e".repeat(64);

globalThis.fetch = (async () => {
  throw new Error("network disabled in tests");
}) as any;

// Route handlers read the signed-in user through lib/helper; tests choose it directly.
let currentUser: any = null;
mock.module(pathToFileURL(path.resolve(process.cwd(), "src/lib/helper.ts")).href, {
  namedExports: {
    getUserFromCookies: async () => currentUser,
    canDeleteFinancialRecords: () => false,
    escapeRegex: (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  },
});

describe("Agency billing: PI → receipt → tax invoice, and Non-GST invoices", () => {
  let mongod: MongoMemoryServer;
  let routes: Record<string, any> = {};
  let Company: any, Counter: any;
  let gstCo: any, nonGstCo: any, gstBank: any, nonGstBank: any, client: any;

  const call = async (handler: any, url: string, init: any = {}, ctxParams?: Record<string, string>) => {
    const res = await handler(new Request(`http://localhost${url}`, init), ctxParams ? { params: Promise.resolve(ctxParams) } : undefined);
    return { status: res.status, json: await res.json() };
  };
  const send = (method: string, handler: any, url: string, body: any, ctxParams?: Record<string, string>) =>
    call(handler, url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, ctxParams);
  const today = () => new Date().toISOString().slice(0, 10);

  before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("billing_test");
    routes = {
      bankAccounts: await import("../src/app/api/billing/bank-accounts/route"),
      bankAccount: await import("../src/app/api/billing/bank-accounts/[id]/route"),
      clients: await import("../src/app/api/billing/clients/route"),
      pis: await import("../src/app/api/billing/pis/route"),
      pi: await import("../src/app/api/billing/pis/[id]/route"),
      taxInvoice: await import("../src/app/api/billing/pis/[id]/tax-invoice/route"),
      invoices: await import("../src/app/api/billing/invoices/route"),
      receipts: await import("../src/app/api/billing/receipts/route"),
      receipt: await import("../src/app/api/billing/receipts/[id]/route"),
    };
    Company = (await import("../src/models/Company")).default;
    Counter = (await import("../src/models/Counter")).default;
    await (await import("../src/lib/db")).default();

    currentUser = { _id: new mongoose.Types.ObjectId(), name: "Fiona Finance", role: "Finance Manager" };

    gstCo = await Company.create({
      name: "TEST GST COMPANY",
      gst: fakeGstin("09"),
      gstType: "GST",
      stateCode: "09",
      taxDefaults: { cgstRate: 9, sgstRate: 9, igstRate: 18 },
      invoiceSeries: { piPrefix: "TPI", taxInvoicePrefix: "TINV" },
    });
    nonGstCo = await Company.create({ name: "TEST NON-GST COMPANY", gstType: "NON_GST", stateCode: "09", invoiceSeries: { nonGstInvoicePrefix: "TNG" } });

    const b1 = await send("POST", routes.bankAccounts.POST, "/api/billing/bank-accounts", {
      companyId: String(gstCo._id), label: "Account A", bankName: "Bank A", accountNumber: "50100123456789", ifsc: "ABCD0001234",
    });
    assert.equal(b1.status, 201, JSON.stringify(b1.json));
    gstBank = b1.json.data;
    const b2 = await send("POST", routes.bankAccounts.POST, "/api/billing/bank-accounts", {
      companyId: String(nonGstCo._id), label: "Account B", bankName: "Bank B", accountNumber: "30012345678",
    });
    assert.equal(b2.status, 201, JSON.stringify(b2.json));
    nonGstBank = b2.json.data;
    assert.equal(gstBank.accountLast4, "6789");
    assert.equal(gstBank.accountNumber, undefined, "account number must never be returned");

    // Client in Maharashtra (27) billed by a UP (09) company -> IGST
    const c = await send("POST", routes.clients.POST, "/api/billing/clients", {
      name: "Test Client", gstin: fakeGstin("27"), billingCompanyIds: [String(gstCo._id), String(nonGstCo._id)],
      defaultBillingCompanyId: String(gstCo._id), serviceDescription: "Digital Marketing Services", defaultBillingAmount: 50000,
    });
    assert.equal(c.status, 201, JSON.stringify(c.json));
    client = c.json.data;
    assert.equal(client.stateCode, "27");
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  test("only finance / admin roles can use billing", async () => {
    const saved = currentUser;
    currentUser = { _id: new mongoose.Types.ObjectId(), name: "Ravi", role: "Counsellor" };
    const res = await call(routes.pis.GET, "/api/billing/pis");
    currentUser = saved;
    assert.equal(res.status, 403);
  });

  let piId = "";
  let piTotal = 0;

  test("creates a PI with IGST for an out-of-state client and numbers it", async () => {
    const res = await send("POST", routes.pis.POST, "/api/billing/pis", {
      clientId: client._id, companyId: String(gstCo._id), piDate: today(), billingPeriodFrom: today(), billingPeriodTo: today(), amount: "50000",
    });
    assert.equal(res.status, 201, JSON.stringify(res.json));
    const pi = res.json.data;
    piId = pi._id;
    piTotal = pi.totalPaise;
    assert.match(pi.piNumber, /^TPI\/\d{4}\/0001$/);
    assert.equal(pi.taxMode, "IGST");
    assert.equal(pi.igstPaise, 900_000);
    assert.equal(pi.totalPaise, 5_900_000);
    assert.equal(pi.description, "Digital Marketing Services");
    assert.equal(pi.client.name, "Test Client");
  });

  test("refuses a PI from a Non-GST company and a direct invoice from a GST company", async () => {
    const pi = await send("POST", routes.pis.POST, "/api/billing/pis", {
      clientId: client._id, companyId: String(nonGstCo._id), piDate: today(), billingPeriodFrom: today(), billingPeriodTo: today(), amount: "100",
    });
    assert.equal(pi.status, 400);
    const inv = await send("POST", routes.invoices.POST, "/api/billing/invoices", {
      clientId: client._id, companyId: String(gstCo._id), invoiceDate: today(), billingPeriodFrom: today(), billingPeriodTo: today(), amount: "100",
    });
    assert.equal(inv.status, 400);
  });

  test("no tax invoice before the PI is paid", async () => {
    const res = await send("POST", routes.taxInvoice.POST, `/api/billing/pis/${piId}/tax-invoice`, {}, { id: piId });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /fully paid/);
  });

  test("receipt rules: right company's bank, not more than due, not in the future", async () => {
    const base = { linkedDocType: "PI", docId: piId, receiptDate: today(), paymentMode: "NEFT", transactionRef: "UTR1" };
    const wrongBank = await send("POST", routes.receipts.POST, "/api/billing/receipts", { ...base, bankAccountId: nonGstBank._id, amount: "100" });
    assert.equal(wrongBank.status, 400);
    assert.match(wrongBank.json.error, /different company/);

    const over = await send("POST", routes.receipts.POST, "/api/billing/receipts", { ...base, bankAccountId: gstBank._id, amount: "60000" });
    assert.equal(over.status, 400);
    assert.match(over.json.error, /still due/);

    const future = await send("POST", routes.receipts.POST, "/api/billing/receipts", {
      ...base, bankAccountId: gstBank._id, amount: "10", receiptDate: "2999-01-01",
    });
    assert.equal(future.status, 400);
  });

  let firstReceiptId = "";

  test("partial then full payment moves the PI to PAID", async () => {
    const base = { linkedDocType: "PI", docId: piId, receiptDate: today(), paymentMode: "NEFT", bankAccountId: gstBank._id };
    const r1 = await send("POST", routes.receipts.POST, "/api/billing/receipts", { ...base, amount: "20000", transactionRef: "UTR-A" });
    assert.equal(r1.status, 201, JSON.stringify(r1.json));
    firstReceiptId = r1.json.data._id;
    assert.match(r1.json.data.receiptNumber, /^RCPT\/\d{4}\/0001$/);
    assert.equal(r1.json.data.gstApplicable, true);

    let pi = (await call(routes.pi.GET, `/api/billing/pis/${piId}`, {}, { id: piId })).json.data;
    assert.equal(pi.status, "PARTIALLY_PAID");
    assert.equal(pi.amountReceivedPaise, 2_000_000);

    // PI cannot be edited or cancelled once money came in
    const edit = await send("PATCH", routes.pi.PATCH, `/api/billing/pis/${piId}`, { action: "EDIT", amount: "1" }, { id: piId });
    assert.equal(edit.status, 400);

    const rest = (piTotal - 2_000_000) / 100;
    const r2 = await send("POST", routes.receipts.POST, "/api/billing/receipts", { ...base, amount: String(rest), transactionRef: "UTR-B" });
    assert.equal(r2.status, 201, JSON.stringify(r2.json));
    pi = (await call(routes.pi.GET, `/api/billing/pis/${piId}`, {}, { id: piId })).json.data;
    assert.equal(pi.status, "PAID");
    assert.equal(pi.receipts.length, 2);
    assert.equal(pi.bank.accountNumber, "50100123456789", "print view shows the full account number");
  });

  test("generates one locked tax invoice from the paid PI", async () => {
    const res = await send("POST", routes.taxInvoice.POST, `/api/billing/pis/${piId}/tax-invoice`, {}, { id: piId });
    assert.equal(res.status, 201, JSON.stringify(res.json));
    const inv = res.json.data;
    assert.match(inv.invoiceNumber, /^TINV\/\d{4}\/0001$/);
    assert.equal(inv.saleType, "REGISTERED");
    assert.equal(inv.totalPaise, piTotal);
    assert.equal(inv.isLocked, true);
    assert.equal(inv.paymentStatus, "PAID");

    const again = await send("POST", routes.taxInvoice.POST, `/api/billing/pis/${piId}/tax-invoice`, {}, { id: piId });
    assert.equal(again.status, 400);
  });

  test("receipts of an invoiced PI can no longer be voided", async () => {
    const res = await send("PATCH", routes.receipt.PATCH, `/api/billing/receipts/${firstReceiptId}`, { action: "VOID", reason: "test" }, { id: firstReceiptId });
    assert.equal(res.status, 400);
  });

  test("Non-GST invoice: no tax, optional payment tracked, voiding reopens it", async () => {
    const res = await send("POST", routes.invoices.POST, "/api/billing/invoices", {
      clientId: client._id, companyId: String(nonGstCo._id), invoiceDate: today(), billingPeriodFrom: today(), billingPeriodTo: today(), amount: "15000",
    });
    assert.equal(res.status, 201, JSON.stringify(res.json));
    const inv = res.json.data;
    assert.match(inv.invoiceNumber, /^TNG\/\d{4}\/0001$/);
    assert.equal(inv.taxPaise, 0);
    assert.equal(inv.saleType, "NON_GST");
    assert.equal(inv.paymentStatus, "UNPAID");

    const r = await send("POST", routes.receipts.POST, "/api/billing/receipts", {
      linkedDocType: "INVOICE", docId: inv._id, bankAccountId: nonGstBank._id, receiptDate: today(), amount: "15000", paymentMode: "UPI", transactionRef: "UPI-1",
    });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.data.gstApplicable, false);

    let list = (await call(routes.invoices.GET, `/api/billing/invoices?pending=1`)).json.data;
    assert.equal(list.length, 0, "fully paid invoice drops out of the pending list");

    const v = await send("PATCH", routes.receipt.PATCH, `/api/billing/receipts/${r.json.data._id}`, { action: "VOID", reason: "wrong client" }, { id: r.json.data._id });
    assert.equal(v.status, 200, JSON.stringify(v.json));
    list = (await call(routes.invoices.GET, `/api/billing/invoices?pending=1`)).json.data;
    assert.equal(list.length, 1);
    assert.equal(list[0].paymentStatus, "UNPAID");
  });

  test("a PI without payments can be cancelled, and its number is not reused", async () => {
    const res = await send("POST", routes.pis.POST, "/api/billing/pis", {
      clientId: client._id, companyId: String(gstCo._id), piDate: today(), billingPeriodFrom: today(), billingPeriodTo: today(), amount: "1000",
    });
    const id = res.json.data._id;
    assert.match(res.json.data.piNumber, /\/0002$/);
    const noReason = await send("PATCH", routes.pi.PATCH, `/api/billing/pis/${id}`, { action: "CANCEL" }, { id });
    assert.equal(noReason.status, 400);
    const cancel = await send("PATCH", routes.pi.PATCH, `/api/billing/pis/${id}`, { action: "CANCEL", reason: "duplicate" }, { id });
    assert.equal(cancel.status, 200);
    assert.equal(cancel.json.data.status, "CANCELLED");

    const next = await send("POST", routes.pis.POST, "/api/billing/pis", {
      clientId: client._id, companyId: String(gstCo._id), piDate: today(), billingPeriodFrom: today(), billingPeriodTo: today(), amount: "1000",
    });
    assert.match(next.json.data.piNumber, /\/0003$/);
  });

  test("a bank account that received money can't be removed", async () => {
    const res = await call(routes.bankAccount.DELETE, `/api/billing/bank-accounts/${gstBank._id}`, { method: "DELETE" }, { id: gstBank._id });
    assert.equal(res.status, 400);
    assert.ok(await Counter.exists({ name: /^billing:PI:/ }));
  });
});
