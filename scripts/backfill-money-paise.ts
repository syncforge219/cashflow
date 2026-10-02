import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom alias loader so @/... imports resolve correctly in Node native ESM
register(pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href, pathToFileURL(process.cwd() + "/"));

// Disable crons during script execution
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

interface Anomaly {
  collection: string;
  id: string;
  field: string;
  value: number;
}

export async function runBackfillMoneyPaise(apply: boolean = false) {
  const { toPaise, hasFractionalPaise } = await import("@/lib/money");
  const { default: Admission } = await import("@/models/Admission");
  const { default: Payment } = await import("@/models/Payment");
  console.log("=========================================================================");
  console.log(`   BACKFILL MONEY PAISE (EXPAND-MIGRATE-CONTRACT: Payment & Admission)   `);
  console.log(`   Mode: ${apply ? "APPLY (WRITING TO DATABASE)" : "DRY-RUN (REPORT ONLY)"} `);
  console.log("=========================================================================\n");

  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  const resolvedUri = await resolveMongoUri(rawUri);
  await mongoose.connect(resolvedUri);
  console.log("✓ Connected to MongoDB\n");

  const anomalies: Anomaly[] = [];

  // ==========================================
  // 1. BACKFILL ADMISSIONS
  // ==========================================
  console.log("--- 1. Auditing Admissions ---");
  const admissions = await Admission.find({}).lean();
  console.log(`Found ${admissions.length} admission documents.`);

  let admissionsToUpdate = 0;
  const admissionMoneyFields: Array<{ rupee: string; paise: string }> = [
    { rupee: "courseFee", paise: "courseFeePaise" },
    { rupee: "scholarshipAmount", paise: "scholarshipAmountPaise" },
    { rupee: "discountAmount", paise: "discountAmountPaise" },
    { rupee: "additionalDiscount", paise: "additionalDiscountPaise" },
    { rupee: "totalDiscount", paise: "totalDiscountPaise" },
    { rupee: "finalFee", paise: "finalFeePaise" },
    { rupee: "maxDiscountLimitAtAdmission", paise: "maxDiscountLimitAtAdmissionPaise" },
    { rupee: "amountReceivedToday", paise: "amountReceivedTodayPaise" },
    { rupee: "registrationAmount", paise: "registrationAmountPaise" },
    { rupee: "downpaymentAmount", paise: "downpaymentAmountPaise" },
    { rupee: "remainingBalance", paise: "remainingBalancePaise" },
    { rupee: "installmentAmount", paise: "installmentAmountPaise" },
    { rupee: "ptpAmount", paise: "ptpAmountPaise" },
  ];

  for (const adm of admissions) {
    const updateDoc: any = {};
    let needsUpdate = false;

    for (const { rupee, paise } of admissionMoneyFields) {
      const val = adm[rupee];
      if (val !== undefined && val !== null) {
        const numVal = Number(val);
        if (!isNaN(numVal)) {
          if (hasFractionalPaise(numVal)) {
            anomalies.push({
              collection: "Admission",
              id: String(adm._id) + (adm.admissionId ? ` (${adm.admissionId})` : ""),
              field: rupee,
              value: numVal,
            });
          }
          const expectedPaise = Math.round(numVal * 100);
          if (adm[paise] === undefined || adm[paise] !== expectedPaise) {
            updateDoc[paise] = expectedPaise;
            needsUpdate = true;
          }
        }
      }
    }

    // Custom EMI plan array
    if (Array.isArray(adm.customEmiPlan)) {
      let emiChanged = false;
      const newPlan = adm.customEmiPlan.map((emi: any, idx: number) => {
        if (emi.amount !== undefined && emi.amount !== null) {
          const num = Number(emi.amount);
          if (hasFractionalPaise(num)) {
            anomalies.push({
              collection: "Admission",
              id: String(adm._id),
              field: `customEmiPlan[${idx}].amount`,
              value: num,
            });
          }
          const p = Math.round(num * 100);
          if (emi.amountPaise !== p) {
            emiChanged = true;
            return { ...emi, amountPaise: p };
          }
        }
        return emi;
      });
      if (emiChanged) {
        updateDoc.customEmiPlan = newPlan;
        needsUpdate = true;
      }
    }

    // Fee followups array
    if (Array.isArray(adm.feeFollowups)) {
      let fChanged = false;
      const newFollowups = adm.feeFollowups.map((f: any, idx: number) => {
        if (f.ptpAmount !== undefined && f.ptpAmount !== null) {
          const num = Number(f.ptpAmount);
          if (hasFractionalPaise(num)) {
            anomalies.push({
              collection: "Admission",
              id: String(adm._id),
              field: `feeFollowups[${idx}].ptpAmount`,
              value: num,
            });
          }
          const p = Math.round(num * 100);
          if (f.ptpAmountPaise !== p) {
            fChanged = true;
            return { ...f, ptpAmountPaise: p };
          }
        }
        return f;
      });
      if (fChanged) {
        updateDoc.feeFollowups = newFollowups;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      admissionsToUpdate++;
      if (apply) {
        await Admission.updateOne({ _id: adm._id }, { $set: updateDoc });
      }
    }
  }

  console.log(`Admissions needing backfill: ${admissionsToUpdate} / ${admissions.length}`);

  // ==========================================
  // 2. BACKFILL PAYMENTS
  // ==========================================
  console.log("\n--- 2. Auditing Payments ---");
  const payments = await Payment.find({}).lean();
  console.log(`Found ${payments.length} payment documents.`);

  let paymentsToUpdate = 0;

  for (const p of payments) {
    const updateDoc: any = {};
    let needsUpdate = false;

    // amountReceived -> amountReceivedPaise
    if (p.amountReceived !== undefined && p.amountReceived !== null) {
      const numVal = Number(p.amountReceived);
      if (!isNaN(numVal)) {
        if (hasFractionalPaise(numVal)) {
          anomalies.push({
            collection: "Payment",
            id: String(p._id) + (p.receiptNo ? ` (${p.receiptNo})` : ""),
            field: "amountReceived",
            value: numVal,
          });
        }
        const expectedPaise = Math.round(numVal * 100);
        if (p.amountReceivedPaise === undefined || p.amountReceivedPaise !== expectedPaise) {
          updateDoc.amountReceivedPaise = expectedPaise;
          needsUpdate = true;
        }
      }
    }

    // Particulars
    if (p.particulars) {
      const partFields = [
        { rupee: "courseFeeDue", paise: "courseFeeDuePaise" },
        { rupee: "registrationFeeDue", paise: "registrationFeeDuePaise" },
        { rupee: "materialFeeDue", paise: "materialFeeDuePaise" },
        { rupee: "examFeeDue", paise: "examFeeDuePaise" },
      ];

      for (const { rupee, paise } of partFields) {
        const val = (p.particulars as any)[rupee];
        if (val !== undefined && val !== null) {
          const num = Number(val);
          if (hasFractionalPaise(num)) {
            anomalies.push({
              collection: "Payment",
              id: String(p._id) + (p.receiptNo ? ` (${p.receiptNo})` : ""),
              field: `particulars.${rupee}`,
              value: num,
            });
          }
          const exp = Math.round(num * 100);
          if ((p.particulars as any)[paise] === undefined || (p.particulars as any)[paise] !== exp) {
            updateDoc[`particulars.${paise}`] = exp;
            needsUpdate = true;
          }
        }
      }
    }

    if (needsUpdate) {
      paymentsToUpdate++;
      if (apply) {
        await Payment.updateOne({ _id: p._id }, { $set: updateDoc });
      }
    }
  }

  console.log(`Payments needing backfill: ${paymentsToUpdate} / ${payments.length}`);

  // ==========================================
  // 3. FRACTIONAL PAISE AUDIT REPORT
  // ==========================================
  console.log("\n=========================================================================");
  console.log(`   FRACTIONAL PAISE REPORT (> 2 DECIMAL PLACES DETECTED)   `);
  console.log("=========================================================================");
  if (anomalies.length === 0) {
    console.log("✓ No floating point drift anomalies detected! All values have <= 2 decimals.");
  } else {
    console.warn(`⚠ Found ${anomalies.length} values with > 2 decimal places:`);
    console.table(anomalies);
  }

  console.log("\n=========================================================================");
  console.log("   SUMMARY");
  console.log("=========================================================================");
  console.log(`Admissions Scanned: ${admissions.length}`);
  console.log(`Admissions ${apply ? "Updated" : "Needing Update"}: ${admissionsToUpdate}`);
  console.log(`Payments Scanned: ${payments.length}`);
  console.log(`Payments ${apply ? "Updated" : "Needing Update"}: ${paymentsToUpdate}`);
  console.log(`Floating point anomalies (>2 decimals): ${anomalies.length}`);
  console.log(`Action: ${apply ? "APPLIED ALL CHANGES" : "DRY-RUN COMPLETE (run with --apply to commit)"}`);
  console.log("=========================================================================\n");

  await mongoose.disconnect();
  return {
    admissionsScanned: admissions.length,
    admissionsToUpdate,
    paymentsScanned: payments.length,
    paymentsToUpdate,
    anomalies,
  };
}

// If run directly from CLI
if (process.argv[1] && process.argv[1].endsWith("backfill-money-paise.ts")) {
  const applyFlag = process.argv.includes("--apply");
  runBackfillMoneyPaise(applyFlag)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    });
}
