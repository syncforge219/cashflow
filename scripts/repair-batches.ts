// One-off / scheduled repair of stored batch data. GET /api/batches no longer writes, so run this
// when needed:  node scripts/repair-batches.ts            (dry run, prints what would change)
//               node scripts/repair-batches.ts --apply    (writes the changes)
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href, pathToFileURL(process.cwd() + "/"));
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") process.loadEnvFile(envPath);

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not defined");
  await mongoose.connect(process.env.MONGODB_URI);

  const { default: Batch } = await import("../src/models/Batch");
  const { computeBatchStatus } = await import("../src/lib/batchHelper");
  const { normalizeBatchTiming } = await import("../src/lib/slotHelper");
  const { nextBatchCode } = await import("../src/lib/batchRules");

  const batches: any[] = await Batch.find({}).sort({ createdAt: 1 }).lean();
  let changed = 0;
  for (const b of batches) {
    const set: any = {};
    if (!b.batchId) set.batchId = apply ? await nextBatchCode() : "(new code)";

    const status = computeBatchStatus(b.startDate, b.endDate, b.status, new Date(), b.statusLocked);
    if (status !== b.status) set.status = status;

    if (!b.timing || !String(b.timing).trim()) set.timing = "10:00 AM - 12:00 PM";
    else {
      const t = normalizeBatchTiming(b.timing, b.batchName);
      if (t && t !== b.timing) set.timing = t;
    }

    if (!b.startDate) set.startDate = b.createdAt ? new Date(b.createdAt) : new Date();

    if (Object.keys(set).length === 0) continue;
    changed++;
    console.log(`${apply ? "FIX " : "WOULD FIX "}${b.batchId || b._id} "${b.batchName}":`, JSON.stringify(set));
    if (apply) await Batch.collection.updateOne({ _id: b._id }, { $set: set });
  }
  console.log(`${changed} of ${batches.length} batches ${apply ? "updated" : "need repair (dry run, nothing written; add --apply)"}.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
