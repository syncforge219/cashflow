/**
 * Backfill script for Student Master Collection (Phase 3)
 *
 * Rules:
 *  - Rule A: Admission with a valid enquiryId -> auto-link both to one Student (explicit link, no review needed).
 *  - Rule B: Record with no phone/email match to any other record -> auto-create its own Student.
 *  - Rule C: Only phone/email matches between records with no explicit link go to the merge-review queue (skipped here).
 *
 * Usage:
 *  npx ts-node scripts/backfill-students.ts           # Dry run (default)
 *  npx ts-node scripts/backfill-students.ts --commit  # Commit changes to database
 */

import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom alias loader so @/... imports resolve correctly in Node native ESM
register(pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href, pathToFileURL(process.cwd() + "/"));

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
      const hostList = records.map((r) => `${r.name}:${r.port}`).sort().join(",");
      return `mongodb://${user}:${encodeURIComponent(pass)}@${hostList}/${dbName}?ssl=true&authSource=admin&${queryParams}`;
    }
  } catch (err: any) {
    console.warn("SRV Resolution notice:", err.message);
  }
  return uri;
}

export async function runBackfill(commit: boolean = false) {
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (_) {}

  const rawUri = process.env.MONGODB_URI;
  if (rawUri) {
    process.env.MONGODB_URI = await resolveMongoUri(rawUri);
  }

  const dbConnect = (await import("../src/lib/db")).default;
  await dbConnect();

  const Student = (await import("../src/models/Student")).default;
  const Enquiry = (await import("../src/models/Enquiry")).default;
  const Admission = (await import("../src/models/Admission")).default;
  const { normalizePhone } = await import("../src/lib/studentHelper");
  const { logAuditEntry } = await import("../src/lib/auditLogger");

  console.log(`\n======================================================`);
  console.log(`  STUDENTS MASTER BACKFILL (${commit ? "COMMIT MODE" : "DRY RUN"})`);
  console.log(`======================================================\n`);

  // 1. Fetch all admissions and enquiries lacking studentId
  const admissions = await Admission.find({ isDeleted: { $ne: true } }).lean();
  const enquiries = await Enquiry.find({ isDeleted: { $ne: true } }).lean();

  console.log(`Total Admissions in DB: ${admissions.length}`);
  console.log(`Total Enquiries in DB:  ${enquiries.length}`);

  const admWithoutStudent = admissions.filter((a) => !a.studentId);
  const enqWithoutStudent = enquiries.filter((e) => !e.studentId);

  console.log(`Admissions needing studentId: ${admWithoutStudent.length}`);
  console.log(`Enquiries needing studentId:  ${enqWithoutStudent.length}`);

  // Build phone and email frequency maps across ALL records to detect collisions
  const phoneCounts = new Map<string, number>();
  const emailCounts = new Map<string, number>();

  for (const adm of admissions) {
    const p = normalizePhone(adm.mobileNumber);
    const e = (adm.email || "").toLowerCase().trim();
    if (p && p.length === 10) phoneCounts.set(p, (phoneCounts.get(p) || 0) + 1);
    if (e && e.includes("@")) emailCounts.set(e, (emailCounts.get(e) || 0) + 1);
  }

  for (const enq of enquiries) {
    const p = normalizePhone(enq.primaryPhoneMobile);
    const e = (enq.emailAddress || "").toLowerCase().trim();
    if (p && p.length === 10) phoneCounts.set(p, (phoneCounts.get(p) || 0) + 1);
    if (e && e.includes("@")) emailCounts.set(e, (emailCounts.get(e) || 0) + 1);
  }

  const enqMap = new Map(enquiries.map((e) => [e._id.toString(), e]));

  let ruleACount = 0; // Explicit link Admission <-> Enquiry
  let ruleBCount = 0; // Unique isolates
  let ruleCSkippedCount = 0; // Ambiguous matches left for merge review queue

  const processedAdmIds = new Set<string>();
  const processedEnqIds = new Set<string>();

  // RULE A: Admission with a valid enquiryId -> auto-link both to one Student
  for (const adm of admWithoutStudent) {
    if (processedAdmIds.has(adm._id.toString())) continue;

    if (adm.enquiryId) {
      const enqIdStr = adm.enquiryId.toString();
      const linkedEnq = enqMap.get(enqIdStr);

      if (linkedEnq) {
        ruleACount++;
        processedAdmIds.add(adm._id.toString());
        processedEnqIds.add(enqIdStr);

        if (commit) {
          const phone = normalizePhone(adm.mobileNumber || linkedEnq.primaryPhoneMobile);
          const student = new Student({
            fullName: adm.fullName || linkedEnq.studentFullName || "Student",
            primaryPhone: phone || "0000000000",
            email: (adm.email || linkedEnq.emailAddress || "").toLowerCase().trim(),
            city: adm.city || linkedEnq.currentCity || "",
            parentName: adm.parentName || linkedEnq.parentsFullName || "",
            parentPhone: normalizePhone(adm.parentPhone || linkedEnq.parentsPhoneNumber),
            status: "ACTIVE",
          });
          await student.save();

          await Admission.updateOne({ _id: adm._id }, { $set: { studentId: student._id } });
          await Enquiry.updateOne({ _id: linkedEnq._id }, { $set: { studentId: student._id } });

          await logAuditEntry({
            collectionName: "students",
            docId: student._id,
            action: "CREATE",
            changedFields: [{ field: "backfillRule", oldValue: null, newValue: "RULE_A_EXPLICIT_LINK" }],
          });
        }
      }
    }
  }

  // RULE B: Unique isolates (no phone/email collision with ANY other record)
  for (const adm of admWithoutStudent) {
    if (processedAdmIds.has(adm._id.toString())) continue;

    const p = normalizePhone(adm.mobileNumber);
    const e = (adm.email || "").toLowerCase().trim();

    const pCount = p ? phoneCounts.get(p) || 0 : 0;
    const eCount = e ? emailCounts.get(e) || 0 : 0;

    if (pCount <= 1 && eCount <= 1) {
      // Isolate! Safe to auto-create
      ruleBCount++;
      processedAdmIds.add(adm._id.toString());

      if (commit) {
        const student = new Student({
          fullName: adm.fullName || "Student",
          primaryPhone: p || "0000000000",
          email: e,
          city: adm.city || "",
          parentName: adm.parentName || "",
          parentPhone: normalizePhone(adm.parentPhone),
          status: "ACTIVE",
        });
        await student.save();

        await Admission.updateOne({ _id: adm._id }, { $set: { studentId: student._id } });

        await logAuditEntry({
          collectionName: "students",
          docId: student._id,
          action: "CREATE",
          changedFields: [{ field: "backfillRule", oldValue: null, newValue: "RULE_B_ISOLATE_ADMISSION" }],
        });
      }
    } else {
      ruleCSkippedCount++;
    }
  }

  for (const enq of enqWithoutStudent) {
    if (processedEnqIds.has(enq._id.toString())) continue;

    const p = normalizePhone(enq.primaryPhoneMobile);
    const e = (enq.emailAddress || "").toLowerCase().trim();

    const pCount = p ? phoneCounts.get(p) || 0 : 0;
    const eCount = e ? emailCounts.get(e) || 0 : 0;

    if (pCount <= 1 && eCount <= 1) {
      // Isolate! Safe to auto-create
      ruleBCount++;
      processedEnqIds.add(enq._id.toString());

      if (commit) {
        const student = new Student({
          fullName: enq.studentFullName || "Student",
          primaryPhone: p || "0000000000",
          email: e,
          city: enq.currentCity || "",
          parentName: enq.parentsFullName || "",
          parentPhone: normalizePhone(enq.parentsPhoneNumber),
          status: "ACTIVE",
        });
        await student.save();

        await Enquiry.updateOne({ _id: enq._id }, { $set: { studentId: student._id } });

        await logAuditEntry({
          collectionName: "students",
          docId: student._id,
          action: "CREATE",
          changedFields: [{ field: "backfillRule", oldValue: null, newValue: "RULE_B_ISOLATE_ENQUIRY" }],
        });
      }
    } else {
      ruleCSkippedCount++;
    }
  }

  console.log(`\n--- Backfill Triage Results ---`);
  console.log(`Rule A (Explicit Admission <-> Enquiry Auto-Linked): ${ruleACount} pairs`);
  console.log(`Rule B (Unique Isolated Records Auto-Created):       ${ruleBCount} records`);
  console.log(`Rule C (Ambiguous Matches Skipped for Staff Queue):   ${ruleCSkippedCount} records`);

  if (!commit) {
    console.log(`\n[DRY RUN COMPLETE] Run with --commit to apply these backfill changes to MongoDB.`);
  } else {
    console.log(`\n[COMMIT COMPLETE] Backfill successfully committed to database.`);
  }

  return {
    ruleACount,
    ruleBCount,
    ruleCSkippedCount,
  };
}

if (process.argv[1] && process.argv[1].endsWith("backfill-students.ts")) {
  const commit = process.argv.includes("--commit");
  runBackfill(commit)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Backfill error:", err);
      process.exit(1);
    });
}
