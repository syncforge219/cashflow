/**
 * Exit Criteria Verification Script for Phase 4 Readiness
 *
 * Requirements:
 *  - 100% of admissions have a valid studentId
 *  - 100% of enquiries have a valid studentId
 *  - Merge review queue has 0 pending candidate clusters
 *  - 0 dangling studentId foreign keys
 *
 * Usage:
 *  npx ts-node scripts/verify-students-migration-readiness.ts
 */

import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom alias loader so @/... imports resolve correctly in Node native ESM
register(pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href, pathToFileURL(process.cwd() + "/"));

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

export async function verifyReadiness() {
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
  const StudentMergeIgnore = (await import("../src/models/StudentMergeIgnore")).default;
  const { normalizePhone } = await import("../src/lib/studentHelper");

  console.log(`\n======================================================`);
  console.log(`  PHASE 4 READINESS EXIT CRITERIA REPORT`);
  console.log(`======================================================\n`);

  // 1. Check Admissions Coverage
  const totalAdmissions = await Admission.countDocuments({ isDeleted: { $ne: true } });
  const unlinkedAdmissions = await Admission.countDocuments({
    isDeleted: { $ne: true },
    $or: [{ studentId: null }, { studentId: { $exists: false } }],
  });
  const admCoverage = totalAdmissions === 0 ? 100 : (((totalAdmissions - unlinkedAdmissions) / totalAdmissions) * 100).toFixed(2);

  // 2. Check Enquiries Coverage
  const totalEnquiries = await Enquiry.countDocuments({ isDeleted: { $ne: true } });
  const unlinkedEnquiries = await Enquiry.countDocuments({
    isDeleted: { $ne: true },
    $or: [{ studentId: null }, { studentId: { $exists: false } }],
  });
  const enqCoverage = totalEnquiries === 0 ? 100 : (((totalEnquiries - unlinkedEnquiries) / totalEnquiries) * 100).toFixed(2);

  // 3. Check Review Queue Status
  const ignores = await StudentMergeIgnore.find({}).lean();
  const ignoreSet = new Set<string>();
  for (const ign of ignores) {
    ignoreSet.add(`${ign.recordIdA}::${ign.recordIdB}`);
    ignoreSet.add(`${ign.recordIdB}::${ign.recordIdA}`);
  }

  const admissions = await Admission.find({ isDeleted: { $ne: true } }).select("_id mobileNumber studentId enquiryId").lean();
  const enquiries = await Enquiry.find({ isDeleted: { $ne: true } }).select("_id primaryPhoneMobile studentId").lean();

  const phoneMap = new Map<string, any[]>();
  for (const a of admissions) {
    const p = normalizePhone(a.mobileNumber);
    if (p && p.length === 10) {
      if (!phoneMap.has(p)) phoneMap.set(p, []);
      phoneMap.get(p)!.push({ id: a._id.toString(), type: "Admission", studentId: a.studentId?.toString(), enquiryId: a.enquiryId?.toString() });
    }
  }
  for (const e of enquiries) {
    const p = normalizePhone(e.primaryPhoneMobile);
    if (p && p.length === 10) {
      if (!phoneMap.has(p)) phoneMap.set(p, []);
      phoneMap.get(p)!.push({ id: e._id.toString(), type: "Enquiry", studentId: e.studentId?.toString() });
    }
  }

  let pendingClusters = 0;
  for (const [phone, records] of phoneMap.entries()) {
    if (records.length <= 1) continue;
    const studentIds = new Set(records.map((r) => r.studentId).filter(Boolean));
    if (studentIds.size === 1 && records.every((r) => r.studentId)) continue; // Merged
    if (records.length === 2 && records[0].type !== records[1].type) {
      const adm = records.find((r) => r.type === "Admission");
      const enq = records.find((r) => r.type === "Enquiry");
      if (adm?.enquiryId === enq?.id) continue;
    }
    const unignored = records.filter((recA, idx) => {
      return records.some((recB, jdx) => {
        if (idx === jdx) return false;
        return !ignoreSet.has(`${recA.id}::${recB.id}`);
      });
    });
    if (unignored.length > 1) {
      pendingClusters++;
    }
  }

  // 4. Verify Foreign Key Integrity
  const allStudentIdsInAdm = await Admission.distinct("studentId", { studentId: { $ne: null } });
  const allStudentIdsInEnq = await Enquiry.distinct("studentId", { studentId: { $ne: null } });
  const combinedIds = Array.from(new Set([...allStudentIdsInAdm, ...allStudentIdsInEnq]));
  const existingStudentsCount = await Student.countDocuments({ _id: { $in: combinedIds } });
  const danglingKeys = combinedIds.length - existingStudentsCount;

  // Print Report Table
  console.log(`1. Admissions Coverage:   ${admCoverage}% (${totalAdmissions - unlinkedAdmissions}/${totalAdmissions} linked)`);
  console.log(`2. Enquiries Coverage:    ${enqCoverage}% (${totalEnquiries - unlinkedEnquiries}/${totalEnquiries} linked)`);
  console.log(`3. Pending Review Queue:  ${pendingClusters} clusters remaining`);
  console.log(`4. Dangling Foreign Keys: ${danglingKeys} broken references\n`);

  const ready =
    unlinkedAdmissions === 0 &&
    unlinkedEnquiries === 0 &&
    pendingClusters === 0 &&
    danglingKeys === 0;

  if (ready) {
    console.log(`[STATUS: READY FOR PHASE 4] 100% of records are linked and review queue is empty.`);
  } else {
    console.log(`[STATUS: NOT READY FOR PHASE 4] Resolve unlinked records and pending review clusters before starting Phase 4.`);
  }

  return {
    ready,
    admCoverage,
    enqCoverage,
    unlinkedAdmissions,
    unlinkedEnquiries,
    pendingClusters,
    danglingKeys,
  };
}

if (process.argv[1] && process.argv[1].endsWith("verify-students-migration-readiness.ts")) {
  verifyReadiness()
    .then((res) => {
      process.exit(res.ready ? 0 : 1);
    })
    .catch((err) => {
      console.error("Verification failed:", err);
      process.exit(1);
    });
}
