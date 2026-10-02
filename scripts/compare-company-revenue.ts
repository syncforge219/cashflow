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

async function main() {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    console.error("MONGODB_URI environment variable is not defined");
    process.exit(1);
  }

  const resolvedUri = await resolveMongoUri(rawUri);
  await mongoose.connect(resolvedUri);

  const { compareCompanyRevenue } = await import("../src/lib/companyRevenueHelper");
  const { getFinancialYearRange } = await import("../src/lib/financialYearHelper");

  const fyRange = getFinancialYearRange();

  console.log("=========================================================================================");
  console.log(`   COMPANY REVENUE DRIFT REPORT (Financial Year: ${fyRange.displayLabel})   `);
  console.log("=========================================================================================\n");

  const reports = await compareCompanyRevenue(fyRange);

  console.log(
    "| " +
    "Company Name".padEnd(32) + " | " +
    "Stored Rev (₹)".padStart(15) + " | " +
    "FY Payments (₹)".padStart(15) + " | " +
    "All-Time (₹)".padStart(15) + " | " +
    "Drift (₹)".padStart(12) + " | " +
    "Status".padEnd(8) + " |"
  );
  console.log("|" + "-".repeat(34) + "|" + "-".repeat(17) + "|" + "-".repeat(17) + "|" + "-".repeat(17) + "|" + "-".repeat(14) + "|" + "-".repeat(10) + "|");

  let totalStored = 0;
  let totalComputedFy = 0;
  let totalComputedAll = 0;
  let driftCount = 0;

  for (const r of reports) {
    totalStored += r.storedRevenue;
    totalComputedFy += r.computedFyRevenue;
    totalComputedAll += r.computedAllTimeRevenue;

    const hasDrift = Math.abs(r.drift) > 0;
    if (hasDrift) driftCount++;

    const statusStr = hasDrift ? "DRIFT" : "OK";

    console.log(
      "| " +
      r.companyName.slice(0, 32).padEnd(32) + " | " +
      r.storedRevenue.toLocaleString("en-IN").padStart(15) + " | " +
      r.computedFyRevenue.toLocaleString("en-IN").padStart(15) + " | " +
      r.computedAllTimeRevenue.toLocaleString("en-IN").padStart(15) + " | " +
      (r.drift >= 0 ? `+${r.drift.toLocaleString("en-IN")}` : r.drift.toLocaleString("en-IN")).padStart(12) + " | " +
      statusStr.padEnd(8) + " |"
    );
  }

  console.log("|" + "-".repeat(34) + "|" + "-".repeat(17) + "|" + "-".repeat(17) + "|" + "-".repeat(17) + "|" + "-".repeat(14) + "|" + "-".repeat(10) + "|");
  console.log(
    "| " +
    "TOTALS".padEnd(32) + " | " +
    totalStored.toLocaleString("en-IN").padStart(15) + " | " +
    totalComputedFy.toLocaleString("en-IN").padStart(15) + " | " +
    totalComputedAll.toLocaleString("en-IN").padStart(15) + " | " +
    ((totalStored - totalComputedFy) >= 0 ? `+${(totalStored - totalComputedFy).toLocaleString("en-IN")}` : `${(totalStored - totalComputedFy).toLocaleString("en-IN")}`).padStart(12) + " | " +
    (driftCount > 0 ? `${driftCount} DRIFT` : "ALL OK").padEnd(8) + " |"
  );

  console.log(`\nSummary:`);
  console.log(`  • Total Companies Audited: ${reports.length}`);
  console.log(`  • Companies with Revenue Drift: ${driftCount}`);
  console.log(`  • Net Stored vs FY Payment Difference: ₹${(totalStored - totalComputedFy).toLocaleString("en-IN")}`);
  console.log(`\nNote: Company.collectedRevenue has been replaced with payment aggregations across all active queries.`);
  console.log("=========================================================================================\n");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Comparison failed:", err);
  process.exit(1);
});
