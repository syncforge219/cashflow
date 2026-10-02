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

export interface BackfillTaskResult {
  totalTasks: number;
  alreadyHadType: number;
  inferredAdmission: number;
  inferredEnquiry: number;
  unclassified: number;
  updatedCount: number;
  isDryRun: boolean;
  samples: Array<{
    taskId: string;
    title: string;
    linkedStudentId?: string;
    linkedEnquiryId?: string;
    taskType: string;
    inferredType: "Admission" | "Enquiry" | "Unclassified";
    reason: string;
  }>;
}

export async function backfillTaskLinkedType(apply: boolean = false): Promise<BackfillTaskResult> {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    throw new Error("MONGODB_URI environment variable is not defined");
  }

  const resolvedUri = await resolveMongoUri(rawUri);
  await mongoose.connect(resolvedUri);

  const { default: Task } = await import("../src/models/Task");
  const { default: Admission } = await import("../src/models/Admission");
  const { default: Enquiry } = await import("../src/models/Enquiry");

  const tasks = await Task.find({}).lean();
  let alreadyHadType = 0;
  let inferredAdmission = 0;
  let inferredEnquiry = 0;
  let unclassified = 0;
  let updatedCount = 0;

  const samples: BackfillTaskResult["samples"] = [];

  for (const t of tasks as any[]) {
    if (t.linkedType === "Admission" || t.linkedType === "Enquiry") {
      alreadyHadType++;
      continue;
    }

    const sId = (t.linkedStudentId || "").trim();
    const eId = (t.linkedEnquiryId || "").trim();
    const upperSId = sId.toUpperCase();
    const upperEId = eId.toUpperCase();
    const tType = (t.taskType || "").trim();

    let inferred: "Admission" | "Enquiry" | null = null;
    let reason = "";

    // 1. Prefix checks (ADM... vs ENQ...)
    if (upperSId.startsWith("ADM")) {
      inferred = "Admission";
      reason = `linkedStudentId prefix: "${sId}"`;
    } else if (upperSId.startsWith("ENQ")) {
      inferred = "Enquiry";
      reason = `linkedStudentId prefix: "${sId}"`;
    } else if (upperEId.startsWith("ENQ") || (eId && !sId)) {
      inferred = "Enquiry";
      reason = `linkedEnquiryId prefix/present: "${eId}"`;
    }

    // 2. ObjectId lookup on Admission and Enquiry
    if (!inferred && sId && /^[0-9a-fA-F]{24}$/.test(sId)) {
      const admDoc = await Admission.findById(sId).select("_id").lean();
      if (admDoc) {
        inferred = "Admission";
        reason = `Matched Admission._id "${sId}"`;
      } else {
        const enqDoc = await Enquiry.findById(sId).select("_id").lean();
        if (enqDoc) {
          inferred = "Enquiry";
          reason = `Matched Enquiry._id "${sId}"`;
        }
      }
    }

    // 3. Alternate lookup by admissionId / enquiryId string
    if (!inferred && sId) {
      const admDoc = await Admission.findOne({ admissionId: sId }).select("_id").lean();
      if (admDoc) {
        inferred = "Admission";
        reason = `Matched Admission.admissionId "${sId}"`;
      } else {
        const enqDoc = await Enquiry.findOne({ enquiryId: sId }).select("_id").lean();
        if (enqDoc) {
          inferred = "Enquiry";
          reason = `Matched Enquiry.enquiryId "${sId}"`;
        }
      }
    }

    // 4. Fallback on SOP Task Type domain conventions
    if (!inferred) {
      if (
        [
          "Document Collection",
          "Fee Collection",
          "Batch Allocation",
          "Welcome Onboarding",
          "EMI Recovery",
        ].includes(tType)
      ) {
        inferred = "Admission";
        reason = `Admission SOP taskType: "${tType}"`;
      } else if (["Lead Call", "Demo"].includes(tType)) {
        inferred = "Enquiry";
        reason = `CRM Lead taskType: "${tType}"`;
      }
    }

    if (inferred === "Admission") {
      inferredAdmission++;
      if (apply) {
        await Task.updateOne({ _id: t._id }, { $set: { linkedType: "Admission" } });
        updatedCount++;
      }
    } else if (inferred === "Enquiry") {
      inferredEnquiry++;
      if (apply) {
        await Task.updateOne({ _id: t._id }, { $set: { linkedType: "Enquiry" } });
        updatedCount++;
      }
    } else {
      unclassified++;
    }

    if (samples.length < 20) {
      samples.push({
        taskId: t._id.toString(),
        title: t.title || "Untitled",
        linkedStudentId: sId || undefined,
        linkedEnquiryId: eId || undefined,
        taskType: tType,
        inferredType: inferred || "Unclassified",
        reason: reason || "No matching identifier or taskType rule",
      });
    }
  }

  await mongoose.disconnect();

  return {
    totalTasks: tasks.length,
    alreadyHadType,
    inferredAdmission,
    inferredEnquiry,
    unclassified,
    updatedCount,
    isDryRun: !apply,
    samples,
  };
}

// CLI Execution
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const isApply = process.argv.includes("--apply");
  console.log("==========================================================================");
  console.log(`   TASK.LINKEDTYPE BACKFILL MIGRATION (${isApply ? "LIVE EXECUTION --apply" : "DRY RUN"})  `);
  console.log("==========================================================================\n");

  backfillTaskLinkedType(isApply)
    .then((result) => {
      console.log(`Mode:                     ${result.isDryRun ? "DRY-RUN (Simulated — no writes performed)" : "LIVE APPLY (Changes committed to database)"}`);
      console.log(`Total Tasks in Database:  ${result.totalTasks}`);
      console.log(`Already Had linkedType:   ${result.alreadyHadType}`);
      console.log(`Inferred as "Admission":  ${result.inferredAdmission}`);
      console.log(`Inferred as "Enquiry":    ${result.inferredEnquiry}`);
      console.log(`Unclassified / Orphaned:  ${result.unclassified}`);
      if (!result.isDryRun) {
        console.log(`Total Tasks Updated:      ${result.updatedCount}`);
      }

      console.log(`\nSample Inferences:`);
      for (const s of result.samples) {
        console.log(`  • [${s.inferredType.padEnd(9)}] Task "${s.title}"`);
        console.log(`      ID: ${s.taskId} | StudentId: ${s.linkedStudentId || "—"} | EnquiryId: ${s.linkedEnquiryId || "—"} | Type: ${s.taskType}`);
        console.log(`      Reason: ${s.reason}`);
      }

      if (result.isDryRun) {
        console.log(`\nTo commit these changes, re-run with: node scripts/backfill-task-linked-type.ts --apply\n`);
      } else {
        console.log(`\n✅ Migration successfully applied!\n`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    });
}
