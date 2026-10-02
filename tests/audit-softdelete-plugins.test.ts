import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
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

describe("Audit Logs, Global Context Plugin & Soft Delete Test Suite", () => {
  let dbConnect: any;
  let User: any;
  let Admission: any;
  let Enquiry: any;
  let Payment: any;
  let Quotation: any;
  let ProformaInvoice: any;
  let PurchaseOrder: any;
  let Expense: any;
  let Payroll: any;
  let AuditLog: any;
  let runWithContext: any;
  let setRequestContextUser: any;
  let logAuditEntry: any;
  let diffAndLogAudit: any;
  let AUDITED_FIELDS: any;
  let validateDeletedAccess: any;

  const mockAdminId = new mongoose.Types.ObjectId();
  const mockSuperAdminId = new mongoose.Types.ObjectId();
  const mockRegularUserId = new mongoose.Types.ObjectId();

  before(async () => {
    try {
      dns.setServers(["8.8.8.8", "1.1.1.1"]);
    } catch (_) {}

    const rawUri = process.env.MONGODB_URI;
    if (rawUri) {
      process.env.MONGODB_URI = await resolveMongoUri(rawUri);
    }

    dbConnect = (await import("../src/lib/db")).default;
    await dbConnect();

    User = (await import("../src/models/User")).default;
    Admission = (await import("../src/models/Admission")).default;
    Enquiry = (await import("../src/models/Enquiry")).default;
    Payment = (await import("../src/models/Payment")).default;
    Quotation = (await import("../src/models/Quotation")).default;
    ProformaInvoice = (await import("../src/models/ProformaInvoice")).default;
    PurchaseOrder = (await import("../src/models/PurchaseOrder")).default;
    Expense = (await import("../src/models/Expense")).default;
    Payroll = (await import("../src/models/Payroll")).default;
    AuditLog = (await import("../src/models/AuditLog")).default;

    const reqCtx = await import("../src/lib/requestContext");
    runWithContext = reqCtx.runWithContext;
    setRequestContextUser = reqCtx.setRequestContextUser;

    const auditMod = await import("../src/lib/auditLogger");
    logAuditEntry = auditMod.logAuditEntry;
    diffAndLogAudit = auditMod.diffAndLogAudit;
    AUDITED_FIELDS = auditMod.AUDITED_FIELDS;

    const accessMod = await import("../src/lib/softDeleteAccess");
    validateDeletedAccess = accessMod.validateDeletedAccess;
  });

  test("1. Mongoose plugin adds timestamps, createdBy, and updatedBy from request context", async () => {
    try {
      await runWithContext({ userId: mockAdminId }, async () => {
        const exp = new Expense({
          title: "Test Plugin Expense " + Date.now(),
          category: "Office",
          amount: 2500,
          expenseDate: new Date(),
          paymentMode: "UPI",
        });
        await exp.save();

        assert.ok(exp.createdAt, "createdAt should be populated by timestamps");
        assert.ok(exp.updatedAt, "updatedAt should be populated by timestamps");
        assert.equal(exp.createdBy?.toString(), mockAdminId.toString(), "createdBy should match context userId");
        assert.equal(exp.updatedBy?.toString(), mockAdminId.toString(), "updatedBy should match context userId");

        // Update in context of another user
        await runWithContext({ userId: mockSuperAdminId }, async () => {
          exp.amount = 3000;
          await exp.save();
          assert.equal(exp.createdBy?.toString(), mockAdminId.toString(), "createdBy must remain original creator");
          assert.equal(exp.updatedBy?.toString(), mockSuperAdminId.toString(), "updatedBy should update to new context user");
        });

        // Cleanup
        await Expense.deleteOne({ _id: exp._id });
      });
    } catch (err) {
      console.error("DEBUG TEST 1 ERROR:", err);
      throw err;
    }
  });

  test("2. audit_logs collection tracks changes to names, phones, fees, discounts, discount approvals, payments, company assignment", async () => {
    const testDocId = new mongoose.Types.ObjectId();

    // 2a. Name change audit
    const nameLog = await logAuditEntry({
      collectionName: "admissions",
      docId: testDocId,
      action: "UPDATE",
      changedFields: [{ field: "fullName", oldValue: "Original Name", newValue: "Updated Name" }],
      userId: mockAdminId,
    });
    assert.ok(nameLog, "Audit log for name change should be created");
    assert.equal(nameLog.collection, "admissions");
    assert.equal(nameLog.changedFields[0].field, "fullName");
    assert.equal(nameLog.changedFields[0].oldValue, "Original Name");
    assert.equal(nameLog.changedFields[0].newValue, "Updated Name");

    // 2b. Phone number change audit
    const phoneLog = await logAuditEntry({
      collectionName: "enquiries",
      docId: testDocId,
      action: "UPDATE",
      changedFields: [{ field: "primaryPhoneMobile", oldValue: "9876543210", newValue: "9998887776" }],
      userId: mockAdminId,
    });
    assert.ok(phoneLog, "Audit log for phone change should be created");
    assert.equal(phoneLog.changedFields[0].field, "primaryPhoneMobile");

    // 2c. Fee, Discount, Discount Approval, and Company Assignment audit via diffAndLogAudit
    const oldAdmission = {
      fullName: "Student Alpha",
      mobileNumber: "9123456789",
      finalFee: 50000,
      discount: 5000,
      discountApproved: false,
      companyAssigned: "Tech Corp",
    };

    const newAdmission = {
      fullName: "Student Alpha",
      mobileNumber: "9123456789",
      finalFee: 45000,
      discount: 10000,
      discountApproved: true,
      companyAssigned: "Skill Hub",
    };

    const diffLog = await diffAndLogAudit({
      collectionName: "admissions",
      docId: testDocId,
      action: "UPDATE",
      oldDoc: oldAdmission,
      newDoc: newAdmission,
      userId: mockAdminId,
    });

    assert.ok(diffLog, "diffAndLogAudit should detect and record differences");
    const loggedFields = diffLog.changedFields.map((cf: any) => cf.field);
    assert.ok(loggedFields.includes("finalFee"), "finalFee change must be audited");
    assert.ok(loggedFields.includes("discount"), "discount change must be audited");
    assert.ok(loggedFields.includes("discountApproved"), "discountApproved change must be audited");
    assert.ok(loggedFields.includes("companyAssigned"), "companyAssigned change must be audited");

    // Cleanup test audit logs
    await AuditLog.deleteMany({ docId: testDocId.toString() });
  });

  test("3. Soft delete fields and default query filtering across all 8 models", async () => {
    try {
      const timeKey = Date.now();

      // Test on Admission, Payment, Enquiry, Expense, Payroll, Quotation, PI, PO
      const enq = await Enquiry.create({
        studentFullName: "SoftDelete Enq " + timeKey,
        primaryPhoneMobile: "9811223344",
        status: "New",
      });

      const adm = await Admission.create({
        fullName: "SoftDelete Student " + timeKey,
        mobileNumber: "9811223344",
        finalFee: 30000,
      });

      const pay = await Payment.create({
        admissionId: adm._id,
        studentName: adm.fullName,
        amountReceived: 10000,
        paymentMode: "Cash",
      });

      const exp = await Expense.create({
        title: "SoftDelete Expense " + timeKey,
        category: "Software",
        amount: 1500,
        paymentMode: "Card",
      });

      const payr = await Payroll.create({
        employeeName: "Staff " + timeKey,
        month: "2026-10",
        baseSalary: 20000,
        netSalary: 20000,
      });

      const quot = await Quotation.create({
        quotationNumber: "QT-" + timeKey,
        customerName: "Client " + timeKey,
        items: [{ name: "Design Pack", quantity: 1, rate: 5000, amount: 5000 }],
      });

      const pi = await ProformaInvoice.create({
        piNumber: "PI-" + timeKey,
        customerName: "Client PI " + timeKey,
        items: [{ name: "Hosting Pack", quantity: 1, rate: 6000, amount: 6000 }],
      });

      const po = await PurchaseOrder.create({
        poNumber: "PO-" + timeKey,
        customerName: "Buyer PO " + timeKey,
        vendorName: "Vendor PO " + timeKey,
        items: [{ name: "Hardware Item", quantity: 2, rate: 4000, amount: 8000 }],
      });

      // Verify all 8 are initially queryable
      assert.ok(await Enquiry.findById(enq._id));
      assert.ok(await Admission.findById(adm._id));
      assert.ok(await Payment.findById(pay._id));
      assert.ok(await Expense.findById(exp._id));
      assert.ok(await Payroll.findById(payr._id));
      assert.ok(await Quotation.findById(quot._id));
      assert.ok(await ProformaInvoice.findById(pi._id));
      assert.ok(await PurchaseOrder.findById(po._id));

      // Soft delete all 8
      await (enq as any).softDelete(mockAdminId);
      await (adm as any).softDelete(mockAdminId);
      await (pay as any).softDelete(mockAdminId);
      await (exp as any).softDelete(mockAdminId);
      await (payr as any).softDelete(mockAdminId);
      await (quot as any).softDelete(mockAdminId);
      await (pi as any).softDelete(mockAdminId);
      await (po as any).softDelete(mockAdminId);

      // Default queries must exclude them
      assert.equal(await Enquiry.findById(enq._id), null, "Default findById must exclude deleted Enquiry");
      assert.equal(await Admission.findById(adm._id), null, "Default findById must exclude deleted Admission");
      assert.equal(await Payment.findById(pay._id), null, "Default findById must exclude deleted Payment");
      assert.equal(await Expense.findById(exp._id), null, "Default findById must exclude deleted Expense");
      assert.equal(await Payroll.findById(payr._id), null, "Default findById must exclude deleted Payroll");
      assert.equal(await Quotation.findById(quot._id), null, "Default findById must exclude deleted Quotation");
      assert.equal(await ProformaInvoice.findById(pi._id), null, "Default findById must exclude deleted ProformaInvoice");
      assert.equal(await PurchaseOrder.findById(po._id), null, "Default findById must exclude deleted PurchaseOrder");

      // Aggregations must exclude soft deleted docs
      const aggResult = await Payment.aggregate([{ $match: { _id: pay._id } }]);
      assert.equal(aggResult.length, 0, "Default aggregation pipeline must exclude deleted records");

      // Bypassing with includeDeleted returns the records
      const bypassedAdm = await Admission.findById(adm._id, null, { includeDeleted: true });
      assert.ok(bypassedAdm, "findById with includeDeleted: true must return soft-deleted document");
      assert.equal(bypassedAdm.isDeleted, true);
      assert.ok(bypassedAdm.deletedAt);
      assert.equal(bypassedAdm.deletedBy?.toString(), mockAdminId.toString());

      // Cleanup
      await Enquiry.deleteOne({ _id: enq._id });
      await Admission.deleteOne({ _id: adm._id });
      await Payment.deleteOne({ _id: pay._id });
      await Expense.deleteOne({ _id: exp._id });
      await Payroll.deleteOne({ _id: payr._id });
      await Quotation.deleteOne({ _id: quot._id });
      await ProformaInvoice.deleteOne({ _id: pi._id });
      await PurchaseOrder.deleteOne({ _id: po._id });
    } catch (err) {
      console.error("DEBUG TEST 3 ERROR:", err);
      throw err;
    }
  });

  test("4. Super Admin access control: only Super Admin can view or restore deleted records", async () => {
    const regularUser = { role: "Counsellor", _id: mockRegularUserId };
    const adminUser = { role: "Admin", _id: mockAdminId };
    const superAdminUser = { role: "Super Admin", _id: mockSuperAdminId };

    // 4a. Non-Super Admin query with ?deleted=true is rejected with 403 Forbidden
    const deniedRegular = validateDeletedAccess(regularUser, new URLSearchParams("deleted=true"));
    assert.ok(deniedRegular.errorResponse, "Regular user cannot view deleted records");
    assert.equal(deniedRegular.errorResponse.status, 403);

    const deniedAdmin = validateDeletedAccess(adminUser, new URLSearchParams("includeDeleted=true"));
    assert.ok(deniedAdmin.errorResponse, "Admin user cannot view deleted records");
    assert.equal(deniedAdmin.errorResponse.status, 403);

    // 4b. Super Admin is allowed
    const allowedSuperAdmin = validateDeletedAccess(superAdminUser, new URLSearchParams("deleted=true"));
    assert.equal(allowedSuperAdmin.errorResponse, undefined);
    assert.equal(allowedSuperAdmin.includeDeleted, true);
    assert.equal(allowedSuperAdmin.onlyDeleted, true);

    // 4c. Restore functionality restores document and its payments
    const testAdm = await Admission.create({
      fullName: "Restore Test Student",
      mobileNumber: "9911223344",
      finalFee: 20000,
    });

    const testPay = await Payment.create({
      admissionId: testAdm._id,
      studentName: testAdm.fullName,
      amountReceived: 5000,
      paymentMode: "UPI",
    });

    // Soft delete
    await (testAdm as any).softDelete(mockAdminId);
    await (testPay as any).softDelete(mockAdminId);

    assert.equal(await Admission.findById(testAdm._id), null);
    assert.equal(await Payment.findById(testPay._id), null);

    // Restore
    await (testAdm as any).restore();
    await Payment.updateMany(
      { admissionId: testAdm._id, isDeleted: true },
      { $set: { isDeleted: false, deletedAt: null, deletedBy: null } }
    );

    // Verify both are restored and visible to normal queries
    const restoredAdm = await Admission.findById(testAdm._id);
    const restoredPay = await Payment.findById(testPay._id);

    assert.ok(restoredAdm, "Restored admission must be visible");
    assert.equal(restoredAdm.isDeleted, false);
    assert.ok(restoredPay, "Restored payment must be visible");
    assert.equal(restoredPay.isDeleted, false);

    // Cleanup
    await Admission.deleteOne({ _id: testAdm._id });
    await Payment.deleteOne({ _id: testPay._id });
  });
});
