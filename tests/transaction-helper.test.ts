import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose, { Schema } from "mongoose";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { MongoMemoryServer, MongoMemoryReplSet } from "mongodb-memory-server";

register(
  pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href,
  pathToFileURL(process.cwd() + "/")
);

let withOptionalTransaction: any;
let isTransactionSupported: any;
let resetTransactionSupportCache: any;

before(async () => {
  const mod = await import("../src/lib/transactionHelper");
  withOptionalTransaction = mod.withOptionalTransaction;
  isTransactionSupported = mod.isTransactionSupported;
  resetTransactionSupportCache = mod.resetTransactionSupportCache;
});

const TestDocSchema = new Schema({
  name: { type: String, required: true },
  value: { type: Number, default: 0 },
});

const TestDoc = mongoose.models.TestDoc || mongoose.model("TestDoc", TestDocSchema);

describe("transactionHelper: Standalone MongoDB vs Replica Set", () => {
  describe("Standalone MongoDB (e.g. VPS / single instance)", () => {
    let mongod: MongoMemoryServer;

    before(async () => {
      mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri());
    });

    after(async () => {
      await mongoose.disconnect();
      await mongod.stop();
    });

    beforeEach(async () => {
      resetTransactionSupportCache();
      await TestDoc.deleteMany({});
    });

    test("correctly detects standalone MongoDB as not supporting transactions", async () => {
      const supported = await isTransactionSupported();
      assert.strictEqual(supported, false, "Standalone MongoDB should not support transactions");
    });

    test("withOptionalTransaction executes callback with session = null and saves data", async () => {
      const result = await withOptionalTransaction(async (session: any) => {
        assert.strictEqual(session, null, "Standalone execution should provide null session");
        const doc = new TestDoc({ name: "standalone_record", value: 42 });
        await doc.save(session ? { session } : undefined);
        return doc;
      });

      assert.ok(result);
      assert.strictEqual(result.name, "standalone_record");
      assert.strictEqual(result.value, 42);

      const saved = await TestDoc.findOne({ name: "standalone_record" });
      assert.ok(saved);
      assert.strictEqual(saved.value, 42);
    });

    test("runtime error in callback bubbles up without crashing server", async () => {
      await assert.rejects(
        async () => {
          await withOptionalTransaction(async () => {
            throw new Error("Validation failed");
          });
        },
        { message: "Validation failed" }
      );
    });
  });

  describe("Replica Set MongoDB (e.g. Atlas / multi-node replSet)", () => {
    let replSet: MongoMemoryReplSet;

    before(async () => {
      replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
      await mongoose.connect(replSet.getUri());
    });

    after(async () => {
      await mongoose.disconnect();
      await replSet.stop();
    });

    beforeEach(async () => {
      resetTransactionSupportCache();
      await TestDoc.deleteMany({});
    });

    test("correctly detects replica set MongoDB as supporting transactions", async () => {
      const supported = await isTransactionSupported();
      assert.strictEqual(supported, true, "ReplicaSet MongoDB should support transactions");
    });

    test("withOptionalTransaction executes callback with an active ClientSession and commits", async () => {
      const result = await withOptionalTransaction(async (session: any) => {
        assert.ok(session, "ReplicaSet execution should provide an active session");
        const doc = new TestDoc({ name: "replset_committed", value: 99 });
        await doc.save(session ? { session } : undefined);
        return doc;
      });

      assert.ok(result);
      assert.strictEqual(result.name, "replset_committed");

      const saved = await TestDoc.findOne({ name: "replset_committed" });
      assert.ok(saved);
      assert.strictEqual(saved.value, 99);
    });

    test("withOptionalTransaction rolls back changes when error is thrown inside transaction", async () => {
      await assert.rejects(
        async () => {
          await withOptionalTransaction(async (session: any) => {
            const doc = new TestDoc({ name: "replset_aborted", value: 123 });
            await doc.save(session ? { session } : undefined);
            throw new Error("Transaction aborted explicitly");
          });
        },
        { message: "Transaction aborted explicitly" }
      );

      // Verify the aborted document was NOT saved
      const found = await TestDoc.findOne({ name: "replset_aborted" });
      assert.strictEqual(found, null, "Aborted transaction write must be rolled back");
    });
  });
});
