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

interface EncryptItemReport {
  collection: string;
  id: string;
  field: string;
  preview: string;
  status: "ENCRYPTED" | "PLAINTEXT_NEEDS_ENCRYPTION";
}

export async function runEncryptFieldsMigration(apply: boolean = false) {
  console.log("=========================================================================");
  console.log(`   APPLICATION-LEVEL FIELD ENCRYPTION MIGRATION (AES-256-GCM)   `);
  console.log(`   Mode: ${apply ? "APPLY (WRITING TO DATABASE)" : "DRY-RUN (REPORT ONLY)"} `);
  console.log("=========================================================================\n");

  const { encryptField, isEncrypted } = await import("@/lib/encryption");
  const { default: JustdialConfig } = await import("@/models/JustdialConfig");
  const { default: Software } = await import("@/models/Software");
  const { default: Company } = await import("@/models/Company");
  const { default: QuotationProfile } = await import("@/models/QuotationProfile");

  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    throw new Error("MONGODB_URI is not defined");
  }

  const resolvedUri = await resolveMongoUri(rawUri);
  await mongoose.connect(resolvedUri);
  console.log("✓ Connected to MongoDB\n");

  const reports: EncryptItemReport[] = [];
  let pendingCount = 0;
  let alreadyEncryptedCount = 0;

  // 1. JustdialConfig
  console.log("--- 1. Auditing JustdialConfig ---");
  const jdConfigs = await JustdialConfig.find({}).select("+apiKey +webhookSecret +pullApiKey").lean();
  for (const cfg of jdConfigs) {
    const updateDoc: any = {};
    let needsUpdate = false;

    for (const field of ["apiKey", "webhookSecret", "pullApiKey"]) {
      const val = (cfg as any)[field];
      if (val && typeof val === "string" && val.trim()) {
        if (isEncrypted(val)) {
          alreadyEncryptedCount++;
          reports.push({
            collection: "JustdialConfig",
            id: String(cfg._id),
            field,
            preview: val.substring(0, 16) + "...",
            status: "ENCRYPTED",
          });
        } else {
          pendingCount++;
          needsUpdate = true;
          const encVal = encryptField(val);
          updateDoc[field] = encVal;
          reports.push({
            collection: "JustdialConfig",
            id: String(cfg._id),
            field,
            preview: val.substring(0, 3) + "***" + val.slice(-3),
            status: "PLAINTEXT_NEEDS_ENCRYPTION",
          });
        }
      }
    }

    if (needsUpdate && apply) {
      await JustdialConfig.updateOne({ _id: cfg._id }, { $set: updateDoc });
    }
  }

  // 2. Software
  console.log("--- 2. Auditing Software ---");
  const softwareList = await Software.find({}).select("+licenseKey").lean();
  for (const sw of softwareList) {
    const val = (sw as any).licenseKey;
    if (val && typeof val === "string" && val.trim()) {
      if (isEncrypted(val)) {
        alreadyEncryptedCount++;
        reports.push({
          collection: "Software",
          id: String(sw._id),
          field: "licenseKey",
          preview: val.substring(0, 16) + "...",
          status: "ENCRYPTED",
        });
      } else {
        pendingCount++;
        const encVal = encryptField(val);
        reports.push({
          collection: "Software",
          id: String(sw._id),
          field: "licenseKey",
          preview: val.substring(0, 3) + "***",
          status: "PLAINTEXT_NEEDS_ENCRYPTION",
        });
        if (apply) {
          await Software.updateOne({ _id: sw._id }, { $set: { licenseKey: encVal } });
        }
      }
    }
  }

  // 3. Company bankDetails
  console.log("--- 3. Auditing Company Bank Details ---");
  const companies = await Company.find({}).select("+bankDetails.accountNumber").lean();
  for (const comp of companies) {
    const acct = (comp as any).bankDetails?.accountNumber;
    if (acct && typeof acct === "string" && acct.trim()) {
      if (isEncrypted(acct)) {
        alreadyEncryptedCount++;
        reports.push({
          collection: "Company",
          id: String(comp._id) + ` (${(comp as any).name})`,
          field: "bankDetails.accountNumber",
          preview: acct.substring(0, 16) + "...",
          status: "ENCRYPTED",
        });
      } else {
        pendingCount++;
        const encVal = encryptField(acct);
        reports.push({
          collection: "Company",
          id: String(comp._id) + ` (${(comp as any).name})`,
          field: "bankDetails.accountNumber",
          preview: acct.substring(0, 3) + "***",
          status: "PLAINTEXT_NEEDS_ENCRYPTION",
        });
        if (apply) {
          await Company.updateOne({ _id: comp._id }, { $set: { "bankDetails.accountNumber": encVal } });
        }
      }
    }
  }

  // 4. QuotationProfile bankDetails
  console.log("--- 4. Auditing QuotationProfile Bank Details ---");
  const qProfiles = await QuotationProfile.find({}).select("+bankDetails.accountNumber").lean();
  for (const qp of qProfiles) {
    const acct = (qp as any).bankDetails?.accountNumber;
    if (acct && typeof acct === "string" && acct.trim()) {
      if (isEncrypted(acct)) {
        alreadyEncryptedCount++;
        reports.push({
          collection: "QuotationProfile",
          id: String(qp._id) + ` (${(qp as any).name})`,
          field: "bankDetails.accountNumber",
          preview: acct.substring(0, 16) + "...",
          status: "ENCRYPTED",
        });
      } else {
        pendingCount++;
        const encVal = encryptField(acct);
        reports.push({
          collection: "QuotationProfile",
          id: String(qp._id) + ` (${(qp as any).name})`,
          field: "bankDetails.accountNumber",
          preview: acct.substring(0, 3) + "***" + acct.slice(-3),
          status: "PLAINTEXT_NEEDS_ENCRYPTION",
        });
        if (apply) {
          await QuotationProfile.updateOne({ _id: qp._id }, { $set: { "bankDetails.accountNumber": encVal } });
        }
      }
    }
  }

  console.log("\n=========================================================================");
  console.log("   ENCRYPTION AUDIT TABLE");
  console.log("=========================================================================");
  if (reports.length === 0) {
    console.log("No confidential fields found to audit.");
  } else {
    console.table(reports);
  }

  console.log("\n=========================================================================");
  console.log("   SUMMARY");
  console.log("=========================================================================");
  console.log(`Fields Already Encrypted: ${alreadyEncryptedCount}`);
  console.log(`Fields Needing Encryption: ${pendingCount}`);
  console.log(`Status: ${apply ? "APPLIED ENCRYPTION TO ALL PENDING FIELDS" : "DRY-RUN COMPLETE (run with --apply to commit)"}`);
  console.log("=========================================================================\n");

  await mongoose.disconnect();
  return {
    alreadyEncryptedCount,
    pendingCount,
    reports,
  };
}

if (process.argv[1] && process.argv[1].endsWith("encrypt-fields.ts")) {
  const applyFlag = process.argv.includes("--apply");
  runEncryptFieldsMigration(applyFlag)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
