/**
 * FIX SCRIPT: Remove wrong company assignments for first two entries
 * 
 * Entry 1: Ujjwal Singhal (ADM000006) — wrongly assigned to SICCES PVT LTD (finalFee: ₹90,000)
 * Entry 2: Chaitanya Singhal (ADM000009) — wrongly assigned to SLING SHOT TECHNOLOGIES (finalFee: ₹18,000)
 * 
 * What this script does:
 * 1. Sets companyAssigned = "Cash" on both admissions
 * 2. Sets company = "CASH" on their payment records
 * 3. Subtracts ₹90,000 from SICCES PVT LTD collectedRevenue (390000 → 300000)
 * 4. Subtracts ₹18,000 from SLING SHOT TECHNOLOGIES collectedRevenue (3842836 → 3824836)
 * 5. Prints BEFORE and AFTER state for verification
 */

const mongoose = require("mongoose");
const dns = require("node:dns");

async function resolveMongoUri(uri) {
  if (!uri || !uri.startsWith("mongodb+srv://")) return uri;
  try { dns.setServers(["8.8.8.8", "1.1.1.1"]); } catch (e) {}
  const match = uri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)\?(.*)$/);
  if (!match) return uri;
  const [, user, pass, host, dbName, queryParams] = match;
  try {
    const records = await new Promise((resolve, reject) => {
      dns.resolveSrv(`_mongodb._tcp.${host}`, (err, a) => err ? reject(err) : resolve(a));
    });
    if (records && records.length > 0) {
      const hostList = records.map(r => `${r.name}:${r.port}`).join(",");
      return `mongodb://${user}:${encodeURIComponent(pass)}@${hostList}/${dbName}?ssl=true&authSource=admin&${queryParams}`;
    }
  } catch (err) {}
  return uri;
}

const ADM_UJJWAL_ID = "6a633db3a95e567b0050d628";   // ADM000006 — Ujjwal Singhal
const PAY_UJJWAL_ID = "6a633db6a95e567b0050d629";   // REC-2026-00005
const ADM_CHAITANYA_ID = "6a6593cfb054a079237a94c9"; // ADM000009 — Chaitanya Singhal
const PAY_CHAITANYA_ID = "6a6593cfb054a079237a94ca"; // REC-2026-00011

const SICCES_ID = "6a61e348432e79c0fd225457";
const SLINGSHOT_ID = "6a61e380432e79c0fd22545a";

const UJJWAL_FEE = 90000;    // finalFee blocked on SICCES
const CHAITANYA_FEE = 18000; // finalFee blocked on SLING SHOT

async function main() {
  const resolved = await resolveMongoUri(process.env.MONGODB_URI);
  await mongoose.connect(resolved);
  const db = mongoose.connection.db;

  // ===== BEFORE STATE =====
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║         BEFORE FIX — Current DB State           ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const beforeAdm6 = await db.collection("admissions").findOne({ _id: new mongoose.Types.ObjectId(ADM_UJJWAL_ID) });
  const beforeAdm9 = await db.collection("admissions").findOne({ _id: new mongoose.Types.ObjectId(ADM_CHAITANYA_ID) });
  const beforePay5 = await db.collection("payments").findOne({ _id: new mongoose.Types.ObjectId(PAY_UJJWAL_ID) });
  const beforePay11 = await db.collection("payments").findOne({ _id: new mongoose.Types.ObjectId(PAY_CHAITANYA_ID) });
  const beforeSicces = await db.collection("companies").findOne({ _id: new mongoose.Types.ObjectId(SICCES_ID) });
  const beforeSling = await db.collection("companies").findOne({ _id: new mongoose.Types.ObjectId(SLINGSHOT_ID) });

  console.log(`ADM000006 (Ujjwal)    → companyAssigned: "${beforeAdm6.companyAssigned}"`);
  console.log(`REC-2026-00005        → company: "${beforePay5.company}"`);
  console.log(`ADM000009 (Chaitanya) → companyAssigned: "${beforeAdm9.companyAssigned}"`);
  console.log(`REC-2026-00011        → company: "${beforePay11.company}"`);
  console.log(`SICCES PVT LTD        → collectedRevenue: ₹${beforeSicces.collectedRevenue.toLocaleString("en-IN")}`);
  console.log(`SLING SHOT TECH       → collectedRevenue: ₹${beforeSling.collectedRevenue.toLocaleString("en-IN")}`);

  // ===== APPLY FIXES =====
  console.log("\n🔧 Applying fixes...\n");

  // 1. Fix Ujjwal admission: SICCES PVT LTD → Cash
  const r1 = await db.collection("admissions").updateOne(
    { _id: new mongoose.Types.ObjectId(ADM_UJJWAL_ID) },
    { $set: { companyAssigned: "Cash" } }
  );
  console.log(`  ✅ ADM000006 companyAssigned → "Cash"  (matched: ${r1.matchedCount}, modified: ${r1.modifiedCount})`);

  // 2. Fix Ujjwal payment: SICCES PVT LTD → CASH
  const r2 = await db.collection("payments").updateOne(
    { _id: new mongoose.Types.ObjectId(PAY_UJJWAL_ID) },
    { $set: { company: "CASH" } }
  );
  console.log(`  ✅ REC-2026-00005 company → "CASH"  (matched: ${r2.matchedCount}, modified: ${r2.modifiedCount})`);

  // 3. Fix Chaitanya admission: SLING SHOT → Cash
  const r3 = await db.collection("admissions").updateOne(
    { _id: new mongoose.Types.ObjectId(ADM_CHAITANYA_ID) },
    { $set: { companyAssigned: "Cash" } }
  );
  console.log(`  ✅ ADM000009 companyAssigned → "Cash"  (matched: ${r3.matchedCount}, modified: ${r3.modifiedCount})`);

  // 4. Fix Chaitanya payment: SLING SHOT → CASH
  const r4 = await db.collection("payments").updateOne(
    { _id: new mongoose.Types.ObjectId(PAY_CHAITANYA_ID) },
    { $set: { company: "CASH" } }
  );
  console.log(`  ✅ REC-2026-00011 company → "CASH"  (matched: ${r4.matchedCount}, modified: ${r4.modifiedCount})`);

  // 5. Subtract ₹90,000 from SICCES PVT LTD collectedRevenue
  const r5 = await db.collection("companies").updateOne(
    { _id: new mongoose.Types.ObjectId(SICCES_ID) },
    { $inc: { collectedRevenue: -UJJWAL_FEE } }
  );
  console.log(`  ✅ SICCES PVT LTD collectedRevenue -= ₹${UJJWAL_FEE.toLocaleString("en-IN")}  (matched: ${r5.matchedCount}, modified: ${r5.modifiedCount})`);

  // 6. Subtract ₹18,000 from SLING SHOT collectedRevenue
  const r6 = await db.collection("companies").updateOne(
    { _id: new mongoose.Types.ObjectId(SLINGSHOT_ID) },
    { $inc: { collectedRevenue: -CHAITANYA_FEE } }
  );
  console.log(`  ✅ SLING SHOT collectedRevenue -= ₹${CHAITANYA_FEE.toLocaleString("en-IN")}  (matched: ${r6.matchedCount}, modified: ${r6.modifiedCount})`);

  // ===== AFTER STATE =====
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║         AFTER FIX — Verified DB State           ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const afterAdm6 = await db.collection("admissions").findOne({ _id: new mongoose.Types.ObjectId(ADM_UJJWAL_ID) });
  const afterAdm9 = await db.collection("admissions").findOne({ _id: new mongoose.Types.ObjectId(ADM_CHAITANYA_ID) });
  const afterPay5 = await db.collection("payments").findOne({ _id: new mongoose.Types.ObjectId(PAY_UJJWAL_ID) });
  const afterPay11 = await db.collection("payments").findOne({ _id: new mongoose.Types.ObjectId(PAY_CHAITANYA_ID) });
  const afterSicces = await db.collection("companies").findOne({ _id: new mongoose.Types.ObjectId(SICCES_ID) });
  const afterSling = await db.collection("companies").findOne({ _id: new mongoose.Types.ObjectId(SLINGSHOT_ID) });

  console.log(`ADM000006 (Ujjwal)    → companyAssigned: "${afterAdm6.companyAssigned}"`);
  console.log(`REC-2026-00005        → company: "${afterPay5.company}"`);
  console.log(`ADM000009 (Chaitanya) → companyAssigned: "${afterAdm9.companyAssigned}"`);
  console.log(`REC-2026-00011        → company: "${afterPay11.company}"`);
  console.log(`SICCES PVT LTD        → collectedRevenue: ₹${beforeSicces.collectedRevenue.toLocaleString("en-IN")} → ₹${afterSicces.collectedRevenue.toLocaleString("en-IN")}`);
  console.log(`SLING SHOT TECH       → collectedRevenue: ₹${beforeSling.collectedRevenue.toLocaleString("en-IN")} → ₹${afterSling.collectedRevenue.toLocaleString("en-IN")}`);

  console.log("\n🎉 All fixes applied successfully!");
  await mongoose.disconnect();
}

main().catch(console.error);
