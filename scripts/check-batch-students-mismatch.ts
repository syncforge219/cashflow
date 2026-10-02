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

export interface BatchMismatchReport {
  batchId: string;
  batchName: string;
  batchObjectId: string;
  brand: string;
  studentsInBatchArrayCount: number;
  admissionsLinkedCount: number;
  admissionsLinkedByIdCount: number;
  admissionsLinkedByNameOnlyCount: number;
  orphanedBatchStudents: string[]; // In Batch.students but not in Admission
  untrackedAdmissions: Array<{ admissionId: string; fullName: string; matchType: string }>; // In Admission but not in Batch.students
  isInSync: boolean;
}

export async function checkBatchStudentsMismatch(): Promise<BatchMismatchReport[]> {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    throw new Error("MONGODB_URI environment variable is not defined");
  }

  const resolvedUri = await resolveMongoUri(rawUri);
  await mongoose.connect(resolvedUri);

  const { default: Batch } = await import("../src/models/Batch");
  const { default: Admission } = await import("../src/models/Admission");

  const batches = await Batch.find({}).sort({ createdAt: -1 }).lean();
  const reports: BatchMismatchReport[] = [];

  for (const b of batches as any[]) {
    const bId = b._id;
    const bCustomId = b.batchId || "";
    const bName = b.batchName || "";
    const batchStudentsArray: string[] = Array.isArray(b.students) ? b.students.map((s: any) => String(s).trim()).filter(Boolean) : [];

    // Query admissions linked by batchId (ObjectId or custom string ID) or legacy batchName
    const queryConditions: any[] = [{ batchId: bId }];
    if (bCustomId) queryConditions.push({ batchId: bCustomId });

    const admissionsById = await Admission.find({ $or: queryConditions })
      .select("fullName studentFullName admissionId mobileNumber batch batchId")
      .lean();

    const admissionsByNameOnly = bName
      ? await Admission.find({
          batch: new RegExp(`^${bName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
          _id: { $nin: admissionsById.map((a: any) => a._id) },
        })
          .select("fullName studentFullName admissionId mobileNumber batch batchId")
          .lean()
      : [];

    const allLinkedAdmissions = [...admissionsById, ...admissionsByNameOnly];

    // Build lookup keys for linked admissions
    const admissionIdentifiers = new Set<string>();
    for (const a of allLinkedAdmissions as any[]) {
      if (a._id) admissionIdentifiers.add(a._id.toString().toLowerCase());
      if (a.admissionId) admissionIdentifiers.add(a.admissionId.trim().toLowerCase());
      if (a.fullName) admissionIdentifiers.add(a.fullName.trim().toLowerCase());
      if (a.studentFullName) admissionIdentifiers.add(a.studentFullName.trim().toLowerCase());
      if (a.mobileNumber) admissionIdentifiers.add(a.mobileNumber.replace(/\D/g, "").slice(-10));
    }

    // Identify orphaned entries in Batch.students
    const orphanedBatchStudents: string[] = [];
    for (const s of batchStudentsArray) {
      const cleanS = s.trim().toLowerCase();
      const cleanDigits = s.replace(/\D/g, "").slice(-10);
      const isMatched =
        admissionIdentifiers.has(cleanS) ||
        (cleanDigits.length === 10 && admissionIdentifiers.has(cleanDigits));
      if (!isMatched) {
        orphanedBatchStudents.push(s);
      }
    }

    // Identify admissions not listed in Batch.students
    const batchStudentsSet = new Set(batchStudentsArray.map((s) => s.toLowerCase()));
    const untrackedAdmissions: Array<{ admissionId: string; fullName: string; matchType: string }> = [];

    for (const a of allLinkedAdmissions as any[]) {
      const admId = (a.admissionId || "").trim().toLowerCase();
      const name = (a.fullName || a.studentFullName || "").trim().toLowerCase();
      const isListed = batchStudentsSet.has(admId) || batchStudentsSet.has(name);
      if (!isListed) {
        const isById = admissionsById.some((x: any) => x._id.toString() === a._id.toString());
        untrackedAdmissions.push({
          admissionId: a.admissionId || "N/A",
          fullName: a.fullName || a.studentFullName || "Unnamed",
          matchType: isById ? "Admission.batchId (ObjectId)" : "Admission.batch (Legacy String)",
        });
      }
    }

    const isInSync = orphanedBatchStudents.length === 0 && untrackedAdmissions.length === 0;

    reports.push({
      batchId: bCustomId || "NO_ID",
      batchName: bName,
      batchObjectId: bId.toString(),
      brand: b.brand || "N/A",
      studentsInBatchArrayCount: batchStudentsArray.length,
      admissionsLinkedCount: allLinkedAdmissions.length,
      admissionsLinkedByIdCount: admissionsById.length,
      admissionsLinkedByNameOnlyCount: admissionsByNameOnly.length,
      orphanedBatchStudents,
      untrackedAdmissions,
      isInSync,
    });
  }

  await mongoose.disconnect();
  return reports;
}

// CLI Execution
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log("==========================================================================");
  console.log("   BATCH.STUDENTS vs ADMISSION.BATCHID MISMATCH AUDIT REPORT (READ-ONLY)  ");
  console.log("==========================================================================\n");

  checkBatchStudentsMismatch()
    .then((reports) => {
      let totalBatches = reports.length;
      let inSyncCount = reports.filter((r) => r.isInSync).length;
      let mismatchCount = totalBatches - inSyncCount;

      for (const r of reports) {
        console.log(`\n--------------------------------------------------------------------------`);
        console.log(`Batch: [${r.batchId}] "${r.batchName}" (Brand: ${r.brand})`);
        console.log(`_id: ${r.batchObjectId}`);
        console.log(`Status: ${r.isInSync ? "✅ IN SYNC" : "⚠️ MISMATCH DETECTED"}`);
        console.log(`  - Batch.students array count:       ${r.studentsInBatchArrayCount}`);
        console.log(`  - Total Admissions linked:           ${r.admissionsLinkedCount}`);
        console.log(`      * Linked via batchId (ID):       ${r.admissionsLinkedByIdCount}`);
        console.log(`      * Linked via batch (Name only):  ${r.admissionsLinkedByNameOnlyCount}`);

        if (r.orphanedBatchStudents.length > 0) {
          console.log(`  - ❌ Orphaned in Batch.students (${r.orphanedBatchStudents.length}):`);
          r.orphanedBatchStudents.forEach((s) => console.log(`       • ${s}`));
        }

        if (r.untrackedAdmissions.length > 0) {
          console.log(`  - ⚠️  Admissions not in Batch.students (${r.untrackedAdmissions.length}):`);
          r.untrackedAdmissions.forEach((a) =>
            console.log(`       • [${a.admissionId}] ${a.fullName} (matched via ${a.matchType})`)
          );
        }
      }

      console.log(`\n==========================================================================`);
      console.log(`AUDIT SUMMARY:`);
      console.log(`Total Batches Inspected:     ${totalBatches}`);
      console.log(`Batches In Perfect Sync:     ${inSyncCount}`);
      console.log(`Batches with Mismatches:     ${mismatchCount}`);
      console.log(`==========================================================================\n`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Audit failed:", err);
      process.exit(1);
    });
}
