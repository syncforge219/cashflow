import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";

// Load .env if present
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

process.env.DISABLE_CRON = "true";

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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface MatchReport {
  stringVal: string;
  count: number;
  status: "matched" | "zero" | "multiple";
  targetId?: mongoose.Types.ObjectId;
  targetDesc?: string;
  candidates?: string[];
}

interface FieldReport {
  collection: string;
  sourceField: string;
  targetField: string;
  totalDocs: number;
  alreadyHadId: number;
  toUpdateCount: number;
  zeroMatchCount: number;
  multipleMatchCount: number;
  details: MatchReport[];
  updates: Array<{ docId: any; targetId: mongoose.Types.ObjectId }>;
}

export async function runBackfill(apply: boolean = false) {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    throw new Error("MONGODB_URI not found in environment variables.");
  }

  const connectionUri = await resolveMongoUri(rawUri);
  console.log(`Connecting to MongoDB... (Mode: ${apply ? "EXECUTE (--apply)" : "DRY-RUN (default)"})`);
  await mongoose.connect(connectionUri, {
    bufferCommands: true,
    serverSelectionTimeoutMS: 10000,
  });

  const db = mongoose.connection.db;
  if (!db) throw new Error("Could not acquire database connection.");

  console.log(`Connected to database: ${mongoose.connection.name}`);
  console.log("===============================================================================");
  console.log(`               EXPAND-MIGRATE-CONTRACT: REF BACKFILL REPORT                    `);
  console.log(` Mode: ${apply ? ">>> COMMIT / APPLYING CHANGES <<<" : ">>> DRY-RUN (Read-Only Preview) <<<"}`);
  console.log("===============================================================================\n");

  // Fetch target reference entities for matching
  const BrandCol = db.collection("brands");
  const CompanyCol = db.collection("companies");
  const UserCol = db.collection("users");
  const EnquiryCol = db.collection("enquiries");

  const allBrands = await BrandCol.find({}).toArray();
  const allCompanies = await CompanyCol.find({}).toArray();
  const allUsers = await UserCol.find({}).toArray();

  // Helper matching functions with strict zero/multiple match reporting (NO GUESSING)
  function matchBrand(val: string): { status: "matched" | "zero" | "multiple"; record?: any; candidates?: string[] } {
    const str = (val || "").trim();
    if (!str || ["all brands", "all", "n/a", "none"].includes(str.toLowerCase())) {
      return { status: "zero" };
    }
    const cleanLower = str.toLowerCase();
    const matches = allBrands.filter((b) => {
      const bName = (b.name || "").trim().toLowerCase();
      const bCode = (b.code || "").trim().toLowerCase();
      const bId = (b.brandId || "").trim().toLowerCase();
      return bName === cleanLower || bCode === cleanLower || bId === cleanLower;
    });

    if (matches.length === 1) return { status: "matched", record: matches[0] };
    if (matches.length > 1) {
      return {
        status: "multiple",
        candidates: matches.map((m) => `${m.name} (${m._id})`),
      };
    }
    return { status: "zero" };
  }

  function matchCompany(val: string): { status: "matched" | "zero" | "multiple"; record?: any; candidates?: string[] } {
    const str = (val || "").trim();
    if (!str || ["cash", "unallocated", "cash (unallocated)", "all companies", "all", "n/a", "none"].includes(str.toLowerCase())) {
      return { status: "zero" };
    }
    const cleanLower = str.toLowerCase();
    const matches = allCompanies.filter((c) => {
      const cName = (c.name || "").trim().toLowerCase();
      const cLegal = (c.legalName || "").trim().toLowerCase();
      const cId = (c.companyId || "").trim().toLowerCase();
      const cUnique = (c.uniqueId || "").trim().toLowerCase();
      return cName === cleanLower || cLegal === cleanLower || cId === cleanLower || cUnique === cleanLower;
    });

    if (matches.length === 1) return { status: "matched", record: matches[0] };
    if (matches.length > 1) {
      return {
        status: "multiple",
        candidates: matches.map((m) => `${m.name} (${m._id})`),
      };
    }
    return { status: "zero" };
  }

  function matchUser(val: string): { status: "matched" | "zero" | "multiple"; record?: any; candidates?: string[] } {
    const str = (val || "").trim();
    if (!str || ["unassigned", "staff", "counsellor", "counselor", "advisor", "admin", "system", "n/a", "none"].includes(str.toLowerCase())) {
      return { status: "zero" };
    }
    const cleanLower = str.toLowerCase();
    const matches = allUsers.filter((u) => {
      const uName = (u.name || "").trim().toLowerCase();
      const uEmail = (u.email || "").trim().toLowerCase();
      return uName === cleanLower || uEmail === cleanLower;
    });

    if (matches.length === 1) return { status: "matched", record: matches[0] };
    if (matches.length > 1) {
      return {
        status: "multiple",
        candidates: matches.map((m) => `${m.name} [${m.email}] (${m._id})`),
      };
    }
    return { status: "zero" };
  }

  const reports: FieldReport[] = [];

  // Generic processor for collection fields
  async function processCollectionField(
    collectionName: string,
    sourceField: string,
    targetField: string,
    matcher: (val: string) => { status: "matched" | "zero" | "multiple"; record?: any; candidates?: string[] }
  ): Promise<FieldReport> {
    const col = db!.collection(collectionName);
    const docs = await col.find({}).toArray();

    let alreadyHadId = 0;
    const stringGroups = new Map<string, any[]>();

    for (const doc of docs) {
      if (doc[targetField] && doc[targetField] instanceof mongoose.Types.ObjectId) {
        alreadyHadId++;
        continue;
      }
      const rawVal = doc[sourceField];
      if (typeof rawVal === "string" && rawVal.trim().length > 0) {
        const str = rawVal.trim();
        if (!stringGroups.has(str)) {
          stringGroups.set(str, []);
        }
        stringGroups.get(str)!.push(doc);
      }
    }

    const details: MatchReport[] = [];
    const updates: Array<{ docId: any; targetId: mongoose.Types.ObjectId }> = [];
    let toUpdateCount = 0;
    let zeroMatchCount = 0;
    let multipleMatchCount = 0;

    for (const [str, matchingDocs] of stringGroups.entries()) {
      const res = matcher(str);
      if (res.status === "matched" && res.record?._id) {
        details.push({
          stringVal: str,
          count: matchingDocs.length,
          status: "matched",
          targetId: res.record._id,
          targetDesc: res.record.name || res.record.title || String(res.record._id),
        });
        toUpdateCount += matchingDocs.length;
        for (const d of matchingDocs) {
          updates.push({ docId: d._id, targetId: res.record._id });
        }
      } else if (res.status === "multiple") {
        details.push({
          stringVal: str,
          count: matchingDocs.length,
          status: "multiple",
          candidates: res.candidates,
        });
        multipleMatchCount += matchingDocs.length;
      } else {
        details.push({
          stringVal: str,
          count: matchingDocs.length,
          status: "zero",
        });
        zeroMatchCount += matchingDocs.length;
      }
    }

    return {
      collection: collectionName,
      sourceField,
      targetField,
      totalDocs: docs.length,
      alreadyHadId,
      toUpdateCount,
      zeroMatchCount,
      multipleMatchCount,
      details,
      updates,
    };
  }

  // 1. Admission: brand -> brandId
  reports.push(await processCollectionField("admissions", "brand", "brandId", matchBrand));

  // 2. Admission: companyAssigned -> companyId
  reports.push(await processCollectionField("admissions", "companyAssigned", "companyId", matchCompany));

  // 3. Admission: counsellor -> counsellorId
  reports.push(await processCollectionField("admissions", "counsellor", "counsellorId", matchUser));

  // 4. Enquiry: targetBrand -> targetBrandId
  reports.push(await processCollectionField("enquiries", "targetBrand", "targetBrandId", matchBrand));

  // 5. Enquiry: assignedCrmAdvisor -> assignedCrmAdvisorId
  reports.push(await processCollectionField("enquiries", "assignedCrmAdvisor", "assignedCrmAdvisorId", matchUser));

  // 6. Payment: brand -> brandId
  reports.push(await processCollectionField("payments", "brand", "brandId", matchBrand));

  // 7. Payment: company -> companyId
  reports.push(await processCollectionField("payments", "company", "companyId", matchCompany));

  // 8. Expense: brand -> brandId
  reports.push(await processCollectionField("expenses", "brand", "brandId", matchBrand));

  // 9. Expense: company -> companyId
  reports.push(await processCollectionField("expenses", "company", "companyId", matchCompany));

  // 10. Batch: brand -> brandId
  reports.push(await processCollectionField("batches", "brand", "brandId", matchBrand));

  // 11. Course: brand -> brandId
  reports.push(await processCollectionField("courses", "brand", "brandId", matchBrand));

  // 12. Standardize Admission.enquiryId to ObjectId
  const AdmissionCol = db.collection("admissions");
  const allAdmissions = await AdmissionCol.find({ enquiryId: { $exists: true, $ne: null } }).toArray();

  let enqAlreadyObjectId = 0;
  let enqToConvertCount = 0;
  let enqZeroMatchCount = 0;
  let enqMultipleMatchCount = 0;
  const enqUpdates: Array<{ docId: any; targetId: mongoose.Types.ObjectId }> = [];
  const enqDetails: MatchReport[] = [];

  for (const adm of allAdmissions) {
    if (adm.enquiryId instanceof mongoose.Types.ObjectId) {
      enqAlreadyObjectId++;
      continue;
    }

    const rawVal = adm.enquiryId;
    const str = String(rawVal).trim();
    if (!str) continue;

    // Check if valid ObjectId string
    if (/^[0-9a-fA-F]{24}$/.test(str)) {
      const targetObjId = new mongoose.Types.ObjectId(str);
      const enqDoc = await EnquiryCol.findOne({ _id: targetObjId });
      if (enqDoc) {
        enqToConvertCount++;
        enqUpdates.push({ docId: adm._id, targetId: targetObjId });
        enqDetails.push({
          stringVal: str,
          count: 1,
          status: "matched",
          targetId: targetObjId,
          targetDesc: `Enquiry _id: ${targetObjId}`,
        });
      } else {
        enqZeroMatchCount++;
        enqDetails.push({
          stringVal: str,
          count: 1,
          status: "zero",
        });
      }
    } else {
      // Check if sequence enquiryId
      const matches = await EnquiryCol.find({ enquiryId: str }).toArray();
      if (matches.length === 1) {
        enqToConvertCount++;
        enqUpdates.push({ docId: adm._id, targetId: matches[0]._id });
        enqDetails.push({
          stringVal: str,
          count: 1,
          status: "matched",
          targetId: matches[0]._id,
          targetDesc: `Enquiry sequence: ${matches[0].enquiryId}`,
        });
      } else if (matches.length > 1) {
        enqMultipleMatchCount++;
        enqDetails.push({
          stringVal: str,
          count: 1,
          status: "multiple",
          candidates: matches.map((m) => `${m.enquiryId} (${m._id})`),
        });
      } else {
        enqZeroMatchCount++;
        enqDetails.push({
          stringVal: str,
          count: 1,
          status: "zero",
        });
      }
    }
  }

  const enqReport: FieldReport = {
    collection: "admissions",
    sourceField: "enquiryId (raw string)",
    targetField: "enquiryId (BSON ObjectId)",
    totalDocs: allAdmissions.length,
    alreadyHadId: enqAlreadyObjectId,
    toUpdateCount: enqToConvertCount,
    zeroMatchCount: enqZeroMatchCount,
    multipleMatchCount: enqMultipleMatchCount,
    details: enqDetails,
    updates: enqUpdates,
  };
  reports.push(enqReport);

  // Print Detailed Findings
  for (const rep of reports) {
    console.log(`\n-------------------------------------------------------------------------------`);
    console.log(` Collection: [${rep.collection}] | Field: ${rep.sourceField} -> ${rep.targetField}`);
    console.log(` Total Docs: ${rep.totalDocs} | Already Valid ObjectId: ${rep.alreadyHadId}`);
    console.log(` Actionable (Can Backfill): ${rep.toUpdateCount}`);
    console.log(` Skipped (Zero Match): ${rep.zeroMatchCount} | Skipped (Multiple Matches): ${rep.multipleMatchCount}`);
    console.log(`-------------------------------------------------------------------------------`);

    if (rep.details.length === 0) {
      console.log(`  (No string fields pending migration)`);
      continue;
    }

    const matchedItems = rep.details.filter((d) => d.status === "matched");
    if (matchedItems.length > 0) {
      console.log(`  [CLEAN MATCHES - WILL BACKFILL]:`);
      for (const m of matchedItems) {
        console.log(`    ✓ "${m.stringVal}" (${m.count} docs) -> ${m.targetDesc} [${m.targetId}]`);
      }
    }

    const zeroItems = rep.details.filter((d) => d.status === "zero");
    if (zeroItems.length > 0) {
      console.log(`  [ZERO MATCHES - SKIPPED / NOT GUESSED]:`);
      for (const z of zeroItems) {
        console.log(`    ⚠ "${z.stringVal}" (${z.count} docs) - No matching record in target collection`);
      }
    }

    const multiItems = rep.details.filter((d) => d.status === "multiple");
    if (multiItems.length > 0) {
      console.log(`  [MULTIPLE MATCHES - AMBIGUOUS / NOT GUESSED]:`);
      for (const mu of multiItems) {
        console.log(`    ✖ "${mu.stringVal}" (${mu.count} docs) - Ambiguous candidates: ${mu.candidates?.join(", ")}`);
      }
    }
  }

  // Summary Table
  console.log("\n==========================================================================================");
  console.log("                               SUMMARY TABLE                                              ");
  console.log("==========================================================================================");
  console.log(
    "Collection".padEnd(14) +
      "Field Mapping".padEnd(38) +
      "Total".padStart(7) +
      "Had ID".padStart(8) +
      "Backfill".padStart(10) +
      "Zero Match".padStart(12) +
      "Ambiguous".padStart(11)
  );
  console.log("-".repeat(100));

  let totalBackfillable = 0;
  let totalZeroMatches = 0;
  let totalAmbiguous = 0;

  for (const rep of reports) {
    const mapping = `${rep.sourceField} -> ${rep.targetField}`;
    console.log(
      rep.collection.padEnd(14) +
        mapping.padEnd(38) +
        String(rep.totalDocs).padStart(7) +
        String(rep.alreadyHadId).padStart(8) +
        String(rep.toUpdateCount).padStart(10) +
        String(rep.zeroMatchCount).padStart(12) +
        String(rep.multipleMatchCount).padStart(11)
    );
    totalBackfillable += rep.toUpdateCount;
    totalZeroMatches += rep.zeroMatchCount;
    totalAmbiguous += rep.multipleMatchCount;
  }
  console.log("-".repeat(100));
  console.log(
    "TOTALS:".padEnd(52) +
      "".padStart(7) +
      "".padStart(8) +
      String(totalBackfillable).padStart(10) +
      String(totalZeroMatches).padStart(12) +
      String(totalAmbiguous).padStart(11)
  );
  console.log("==========================================================================================\n");

  // Apply changes if requested
  if (apply) {
    console.log(">>> APPLYING BACKFILL TO DATABASE... <<<");
    let totalUpdated = 0;

    for (const rep of reports) {
      if (rep.updates.length === 0) continue;

      const col = db.collection(rep.collection);
      const bulkOps = rep.updates.map((u) => ({
        updateOne: {
          filter: { _id: u.docId },
          update: { $set: { [rep.targetField]: u.targetId } },
        },
      }));

      const res = await col.bulkWrite(bulkOps);
      console.log(`✓ [${rep.collection}] Set ${rep.targetField}: updated ${res.modifiedCount} documents.`);
      totalUpdated += res.modifiedCount;
    }

    console.log(`\n🎉 Backfill successfully completed! Total documents updated: ${totalUpdated}`);
  } else {
    console.log("💡 DRY RUN COMPLETE: No changes were written to the database.");
    console.log("To execute and commit these updates, run with the --apply flag:");
    console.log("  npx tsx scripts/backfill-refs.ts --apply\n");
  }

  await mongoose.disconnect();
}

// Direct execution
if (process.argv[1] && process.argv[1].endsWith("backfill-refs.ts")) {
  const isApply = process.argv.includes("--apply");
  runBackfill(isApply)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    });
}
