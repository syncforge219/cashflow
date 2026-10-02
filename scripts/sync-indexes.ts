import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom alias loader so @/... imports resolve correctly in Node native ESM
register(pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href, pathToFileURL(process.cwd() + "/"));

// Load environment variables from .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

async function resolveMongoUri(uri: string): Promise<string> {
  if (!uri || !uri.startsWith("mongodb+srv://")) return uri;

  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (e) {
    // Ignore DNS override error
  }

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
    console.warn("SRV Resolution fallback notice:", err.message);
  }

  return uri;
}

export interface SyncResult {
  modelName: string;
  collectionName: string;
  status: "SUCCESS" | "FAILED";
  indexesCount: number;
  indexes: Array<{
    name: string;
    key: Record<string, any>;
    unique?: boolean;
    sparse?: boolean;
    expireAfterSeconds?: number;
    partialFilterExpression?: any;
  }>;
  error?: string;
}

export async function syncAllIndexes(): Promise<SyncResult[]> {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    throw new Error("MONGODB_URI not found in environment variables.");
  }

  const connectionUri = await resolveMongoUri(rawUri);
  console.log("Connecting to MongoDB Atlas to synchronize indexes...");
  await mongoose.connect(connectionUri, {
    bufferCommands: true,
    serverSelectionTimeoutMS: 10000,
  });

  // Dynamically load models after registering module loader
  const { default: Session } = await import("../src/models/Session");
  const { default: JustdialLeadLog } = await import("../src/models/JustdialLeadLog");
  const { default: Admission } = await import("../src/models/Admission");
  const { default: Payment } = await import("../src/models/Payment");
  const { default: Task } = await import("../src/models/Task");
  const { default: Notification } = await import("../src/models/Notification");
  const { default: Enquiry } = await import("../src/models/Enquiry");
  const { default: User } = await import("../src/models/User");
  const { default: Company } = await import("../src/models/Company");
  const { default: Brand } = await import("../src/models/Brand");
  const { default: Course } = await import("../src/models/Course");
  const { default: Batch } = await import("../src/models/Batch");
  const { default: Attendance } = await import("../src/models/Attendance");
  const { default: StaffAttendance } = await import("../src/models/StaffAttendance");
  const { default: Expense } = await import("../src/models/Expense");

  const modelsToSync: Array<{ name: string; model: mongoose.Model<any> }> = [
    { name: "Session", model: Session },
    { name: "JustdialLeadLog", model: JustdialLeadLog },
    { name: "Admission", model: Admission },
    { name: "Payment", model: Payment },
    { name: "Task", model: Task },
    { name: "Notification", model: Notification },
    { name: "Enquiry", model: Enquiry },
    { name: "User", model: User },
    { name: "Company", model: Company },
    { name: "Brand", model: Brand },
    { name: "Course", model: Course },
    { name: "Batch", model: Batch },
    { name: "Attendance", model: Attendance },
    { name: "StaffAttendance", model: StaffAttendance },
    { name: "Expense", model: Expense },
  ];

  const results: SyncResult[] = [];

  for (const { name, model } of modelsToSync) {
    const collName = model.collection.name;
    console.log(`\nSynchronizing indexes for ${name} (collection: "${collName}")...`);
    try {
      // Calls Model.syncIndexes() so index builds are run deliberately on demand
      await model.syncIndexes();

      // Retrieve actual indexes currently registered in MongoDB
      const rawIndexes = await model.collection.indexes();
      const mappedIndexes = rawIndexes.map((idx: any) => ({
        name: idx.name,
        key: idx.key,
        unique: idx.unique,
        sparse: idx.sparse,
        expireAfterSeconds: idx.expireAfterSeconds,
        partialFilterExpression: idx.partialFilterExpression,
      }));

      console.log(`[SUCCESS] ${name}: ${mappedIndexes.length} active indexes.`);
      results.push({
        modelName: name,
        collectionName: collName,
        status: "SUCCESS",
        indexesCount: mappedIndexes.length,
        indexes: mappedIndexes,
      });
    } catch (err: any) {
      console.error(`[ERROR] Failed syncing indexes for ${name}:`, err.message);
      results.push({
        modelName: name,
        collectionName: collName,
        status: "FAILED",
        indexesCount: 0,
        indexes: [],
        error: err.message,
      });
    }
  }

  return results;
}

async function main() {
  try {
    const results = await syncAllIndexes();

    console.log("\n=======================================================");
    console.log("             INDEX SYNCHRONIZATION REPORT");
    console.log("=======================================================");

    for (const r of results) {
      console.log(`\nModel: ${r.modelName} (Collection: "${r.collectionName}") | Status: [${r.status}]`);
      if (r.status === "SUCCESS") {
        console.log(`Total Indexes: ${r.indexesCount}`);
        for (const idx of r.indexes) {
          const extras: string[] = [];
          if (idx.unique) extras.push("UNIQUE");
          if (idx.sparse) extras.push("SPARSE");
          if (idx.expireAfterSeconds !== undefined) extras.push(`TTL: ${idx.expireAfterSeconds}s`);
          if (idx.partialFilterExpression) extras.push(`PARTIAL: ${JSON.stringify(idx.partialFilterExpression)}`);

          const flags = extras.length > 0 ? ` [${extras.join(", ")}]` : "";
          console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}${flags}`);
        }
      } else {
        console.log(`  Error: ${r.error}`);
      }
    }

    const failed = results.filter((r) => r.status === "FAILED");
    console.log("\n=======================================================");
    if (failed.length > 0) {
      console.log(`STATUS: COMPLETED WITH ${failed.length} FAILURE(S)`);
      process.exitCode = 1;
    } else {
      console.log("STATUS: ALL INDEXES SYNCHRONIZED SUCCESSFULLY!");
    }
    console.log("=======================================================\n");
  } catch (error: any) {
    console.error("Index synchronization script fatal error:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
