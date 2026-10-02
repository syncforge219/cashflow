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

export async function migrateDiscountApprovalStatus(apply: boolean = false) {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    throw new Error("MONGODB_URI not found in environment variables.");
  }

  const connectionUri = await resolveMongoUri(rawUri);
  console.log(`Connecting to MongoDB (Mode: ${apply ? "APPLY / EXECUTE" : "DRY-RUN"})...`);
  await mongoose.connect(connectionUri, {
    bufferCommands: true,
    serverSelectionTimeoutMS: 10000,
  });

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Failed to get native MongoDB database reference.");
  }

  const admissionsCollection = db.collection("admissions");
  const notificationsCollection = db.collection("notifications");

  // Query all admissions where discountApprovalStatus === "Read"
  const readAdmissions = await admissionsCollection
    .find({ discountApprovalStatus: "Read" })
    .toArray();

  const totalCount = readAdmissions.length;
  console.log(`\n=======================================================`);
  console.log(`       DISCOUNT APPROVAL STATUS MIGRATION AUDIT`);
  console.log(`=======================================================`);
  console.log(`Total Admissions with discountApprovalStatus == "Read": ${totalCount}`);

  if (totalCount === 0) {
    console.log(`\n[OK] Zero admissions have discountApprovalStatus == "Read". Database is clean.`);
    console.log(`No migration actions needed.`);
    console.log(`=======================================================\n`);
    return { totalCount: 0, mappedApproved: 0, mappedPending: 0, applied: apply };
  }

  let mappedApproved = 0;
  let mappedPending = 0;

  for (const adm of readAdmissions) {
    const totalDiscountGiven =
      Number(adm.discountAmount || 0) +
      Number(adm.scholarshipAmount || 0) +
      Number(adm.additionalDiscount || 0);

    const maxAllowedLimit = Number(adm.maxDiscountLimitAtAdmission || 5000);
    // If discount given exceeded allowable limit, it requires managerial approval ("Pending Approval")
    // Otherwise, standard discount within policy is "Approved"
    const targetStatus = totalDiscountGiven > maxAllowedLimit ? "Pending Approval" : "Approved";

    if (targetStatus === "Approved") mappedApproved++;
    else mappedPending++;

    console.log(`- Admission ${adm.admissionId || adm._id} (${adm.fullName || "Student"}):`);
    console.log(`  Discount: ₹${totalDiscountGiven} | Max Allowed: ₹${maxAllowedLimit}`);
    console.log(`  Current Status: "Read" -> Target Status: "${targetStatus}"`);

    if (apply) {
      await admissionsCollection.updateOne(
        { _id: adm._id },
        { $set: { discountApprovalStatus: targetStatus } }
      );

      // Ensure any linked notification has read: true (preserving the user's read acknowledgment)
      const admIdStr = adm._id.toString();
      await notificationsCollection.updateMany(
        {
          $or: [
            { admissionId: adm.admissionId },
            { admissionId: admIdStr },
          ],
        },
        { $set: { read: true } }
      );
    }
  }

  console.log(`\nMigration Breakdown:`);
  console.log(`- Total Found: ${totalCount}`);
  console.log(`- Will map to "Approved": ${mappedApproved}`);
  console.log(`- Will map to "Pending Approval": ${mappedPending}`);

  if (apply) {
    console.log(`\n[SUCCESS] Successfully applied status migration to ${totalCount} records.`);
  } else {
    console.log(`\n[DRY-RUN COMPLETE] No database records were modified.`);
    console.log(`To apply changes, re-run with: node scripts/migrate-discount-approval-status.ts --apply`);
  }
  console.log(`=======================================================\n`);

  return { totalCount, mappedApproved, mappedPending, applied: apply };
}

async function main() {
  const isApply = process.argv.includes("--apply");
  try {
    await migrateDiscountApprovalStatus(isApply);
  } catch (error: any) {
    console.error("Migration error:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
