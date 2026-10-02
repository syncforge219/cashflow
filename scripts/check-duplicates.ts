import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";

// Load .env if present
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

async function resolveMongoUri(uri: string): Promise<string> {
  if (!uri || !uri.startsWith("mongodb+srv://")) return uri;

  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (e) {
    // Ignore DNS server override error
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
        .map(r => `${r.name}:${r.port}`)
        .sort()
        .join(",");
      return `mongodb://${user}:${encodeURIComponent(pass)}@${hostList}/${dbName}?ssl=true&authSource=admin&${queryParams}`;
    }
  } catch (err: any) {
    console.warn("SRV Resolution fallback notice:", err.message);
  }

  return uri;
}

export interface DuplicateReportItem {
  key: string;
  count: number;
  documents: Array<{
    _id: string;
    identifier?: string;
    createdAt?: any;
    additionalInfo?: any;
  }>;
}

export interface CollectionCheckResult {
  collection: string;
  field: string;
  totalDocuments: number;
  nullOrMissingCount: number;
  duplicateCount: number;
  duplicates: DuplicateReportItem[];
}

export async function checkDuplicates(): Promise<{
  results: CollectionCheckResult[];
  hasAnyDuplicates: boolean;
}> {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    throw new Error("MONGODB_URI not found in environment variables.");
  }

  const connectionUri = await resolveMongoUri(rawUri);
  console.log("Connecting to MongoDB for read-only duplicate verification...");
  await mongoose.connect(connectionUri, {
    bufferCommands: true,
    serverSelectionTimeoutMS: 8000,
  });

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Failed to get native MongoDB database reference.");
  }

  const results: CollectionCheckResult[] = [];

  // ==========================================
  // 1. Check JustdialLeadLog on leadId
  // ==========================================
  console.log("\n[1/3] Checking collection 'justdialleadlogs' on field 'leadId'...");
  const jdColl = db.collection("justdialleadlogs");
  const jdTotal = await jdColl.countDocuments({});
  const jdNullMissing = await jdColl.countDocuments({
    $or: [{ leadId: { $exists: false } }, { leadId: null }, { leadId: "" }]
  });

  const jdDupPipeline = [
    {
      $match: {
        leadId: { $exists: true, $ne: null, $nin: ["", "N/A"] }
      }
    },
    {
      $group: {
        _id: "$leadId",
        count: { $sum: 1 },
        docIds: { $push: "$$ROOT" }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    },
    {
      $sort: { count: -1 as const }
    }
  ];

  const jdDupAgg = await jdColl.aggregate(jdDupPipeline).toArray();
  const jdDuplicates: DuplicateReportItem[] = jdDupAgg.map((item: any) => ({
    key: String(item._id),
    count: item.count,
    documents: item.docIds.map((d: any) => ({
      _id: String(d._id),
      identifier: d.leadName || d.mobile || "N/A",
      createdAt: d.timestamp || d.createdAt,
      additionalInfo: { mobile: d.mobile, status: d.status, sourceType: d.sourceType }
    }))
  }));

  results.push({
    collection: "justdialleadlogs",
    field: "leadId",
    totalDocuments: jdTotal,
    nullOrMissingCount: jdNullMissing,
    duplicateCount: jdDuplicates.length,
    duplicates: jdDuplicates
  });

  // ==========================================
  // 2. Check Admission on enquiryId (partial: where enquiryId exists)
  // ==========================================
  console.log("\n[2/3] Checking collection 'admissions' on field 'enquiryId' (where enquiryId exists)...");
  const admColl = db.collection("admissions");
  const admTotal = await admColl.countDocuments({});
  const admNullMissing = await admColl.countDocuments({
    $or: [{ enquiryId: { $exists: false } }, { enquiryId: null }]
  });

  const admDupPipeline = [
    {
      $match: {
        enquiryId: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: "$enquiryId",
        count: { $sum: 1 },
        docIds: { $push: "$$ROOT" }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    },
    {
      $sort: { count: -1 as const }
    }
  ];

  const admDupAgg = await admColl.aggregate(admDupPipeline).toArray();
  const admDuplicates: DuplicateReportItem[] = admDupAgg.map((item: any) => ({
    key: String(item._id),
    count: item.count,
    documents: item.docIds.map((d: any) => ({
      _id: String(d._id),
      identifier: `${d.admissionId || "No ID"} - ${d.fullName || "Unnamed"}`,
      createdAt: d.admissionDate || d.createdAt,
      additionalInfo: {
        admissionId: d.admissionId,
        fullName: d.fullName,
        mobileNumber: d.mobileNumber,
        course: d.course,
        status: d.status
      }
    }))
  }));

  results.push({
    collection: "admissions",
    field: "enquiryId",
    totalDocuments: admTotal,
    nullOrMissingCount: admNullMissing,
    duplicateCount: admDuplicates.length,
    duplicates: admDuplicates
  });

  // ==========================================
  // 3. Check Payment on receiptNo
  // ==========================================
  console.log("\n[3/3] Checking collection 'payments' on field 'receiptNo'...");
  const payColl = db.collection("payments");
  const payTotal = await payColl.countDocuments({});
  const payNullMissing = await payColl.countDocuments({
    $or: [{ receiptNo: { $exists: false } }, { receiptNo: null }, { receiptNo: "" }]
  });

  const payDupPipeline = [
    {
      $match: {
        receiptNo: { $exists: true, $ne: null, $nin: ["", "N/A"] }
      }
    },
    {
      $group: {
        _id: "$receiptNo",
        count: { $sum: 1 },
        docIds: { $push: "$$ROOT" }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    },
    {
      $sort: { count: -1 as const }
    }
  ];

  const payDupAgg = await payColl.aggregate(payDupPipeline).toArray();
  const payDuplicates: DuplicateReportItem[] = payDupAgg.map((item: any) => ({
    key: String(item._id),
    count: item.count,
    documents: item.docIds.map((d: any) => ({
      _id: String(d._id),
      identifier: `${d.receiptNo} - ${d.studentName || "No Name"}`,
      createdAt: d.paymentDate || d.createdAt,
      additionalInfo: {
        amountReceived: d.amountReceived,
        studentName: d.studentName,
        paymentMode: d.paymentMode,
        company: d.company,
        brand: d.brand
      }
    }))
  }));

  results.push({
    collection: "payments",
    field: "receiptNo",
    totalDocuments: payTotal,
    nullOrMissingCount: payNullMissing,
    duplicateCount: payDuplicates.length,
    duplicates: payDuplicates
  });

  const hasAnyDuplicates = results.some((r) => r.duplicateCount > 0);

  return { results, hasAnyDuplicates };
}

async function main() {
  try {
    const { results, hasAnyDuplicates } = await checkDuplicates();

    console.log("\n=======================================================");
    console.log("       DUPLICATE VERIFICATION AUDIT REPORT");
    console.log("=======================================================");

    for (const res of results) {
      console.log(`\nCollection: "${res.collection}" | Field: "${res.field}"`);
      console.log(`- Total Documents: ${res.totalDocuments}`);
      console.log(`- Null / Missing / Empty: ${res.nullOrMissingCount}`);
      console.log(`- Distinct Duplicate Keys: ${res.duplicateCount}`);

      if (res.duplicateCount === 0) {
        console.log(`  [OK] Zero duplicates found. Unique index is SAFE to create.`);
      } else {
        console.log(`  [WARNING] Found ${res.duplicateCount} duplicate key group(s)! Unique index creation CANNOT proceed until resolved:`);
        for (const item of res.duplicates) {
          console.log(`\n  Duplicate Key: "${item.key}" (Count: ${item.count})`);
          for (const doc of item.documents) {
            console.log(`    - _id: ${doc._id} | ${doc.identifier} | Created: ${doc.createdAt} | Info:`, JSON.stringify(doc.additionalInfo));
          }
        }
      }
    }

    console.log("\n=======================================================");
    if (hasAnyDuplicates) {
      console.log("STATUS: DUPLICATES DETECTED. DO NOT APPLY UNIQUE INDEXES TO DUPLICATE FIELDS.");
    } else {
      console.log("STATUS: ALL TARGET FIELDS ARE CLEAN. UNIQUE INDEXES SAFE TO CREATE.");
    }
    console.log("=======================================================\n");
  } catch (error: any) {
    console.error("Error executing duplicate check script:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
