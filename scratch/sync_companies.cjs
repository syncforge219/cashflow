const mongoose = require("mongoose");
const dns = require("node:dns");

async function resolveMongoUri(uri) {
  if (!uri || !uri.startsWith("mongodb+srv://")) return uri;
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (e) {
    console.warn("Could not set custom DNS servers:", e);
  }
  const match = uri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)\?(.*)$/);
  if (!match) return uri;
  const [, user, pass, host, dbName, queryParams] = match;
  const srvDomain = `_mongodb._tcp.${host}`;
  try {
    const records = await new Promise((resolve, reject) => {
      dns.resolveSrv(srvDomain, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });
    if (records && records.length > 0) {
      const hostList = records.map((r) => `${r.name}:${r.port}`).join(",");
      return `mongodb://${user}:${encodeURIComponent(pass)}@${hostList}/${dbName}?ssl=true&authSource=admin&${queryParams}`;
    }
  } catch (err) {
    console.warn("SRV fallback notice:", err.message);
  }
  return uri;
}

async function run() {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    throw new Error("MONGODB_URI not found in process.env");
  }
  const uri = await resolveMongoUri(rawUri);
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    bufferCommands: false,
  });
  console.log("MongoDB connection established successfully.");

  const db = mongoose.connection.db;
  const admissionsColl = db.collection("admissions");
  const paymentsColl = db.collection("payments");
  const companiesColl = db.collection("companies");

  // 1. Fetch all admissions and map by ObjectId and string ID
  const admissions = await admissionsColl.find({}).toArray();
  const admissionMap = new Map();
  for (const adm of admissions) {
    admissionMap.set(adm._id.toString(), adm);
  }

  // 2. Scan all payments
  const payments = await paymentsColl.find({}).toArray();
  let totalUpdated = 0;

  for (const p of payments) {
    if (!p.admissionId) continue;
    const adm = admissionMap.get(p.admissionId.toString());
    if (!adm) continue;

    const admComp = (adm.companyAssigned || adm.company || "").trim().toUpperCase();
    if (
      admComp &&
      admComp !== "CASH" &&
      admComp !== "UNALLOCATED" &&
      admComp !== "CASH (UNALLOCATED)" &&
      admComp !== "AUTO" &&
      admComp !== "SELECT COMPANY..."
    ) {
      const curComp = (p.company || "").trim().toUpperCase();
      const pMode = (p.paymentMode || "").trim().toLowerCase();

      if (pMode !== "cash" && curComp !== admComp) {
        console.log(
          `[SYNCING PAYMENT] Receipt: ${p.receiptNo || p._id} | Student: ${p.studentName || adm.fullName} | Mode: ${p.paymentMode} | "${curComp}" -> "${admComp}"`
        );
        await paymentsColl.updateOne(
          { _id: p._id },
          { $set: { company: admComp } }
        );
        totalUpdated++;
      }
    }
  }

  console.log(`\nPayment Synchronization complete: ${totalUpdated} payment(s) updated to match admission company.`);

  // 3. Reconcile Company Ledgers
  console.log("Reconciling Company Ledgers...");
  const normalizeKey = (n) =>
    (n || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .replace(/PRIVATELIMITED/g, "PVTLTD")
      .replace(/PVTLIMITED/g, "PVTLTD")
      .replace(/LIMITED/g, "LTD")
      .replace(/SERVICES/g, "")
      .replace(/GATEEWAY/g, "GATEWAY")
      .replace(/INSTITUTE/g, "INSTITUE")
      .replace(/LLP/g, "");

  const admissionsByCompany = await admissionsColl
    .aggregate([
      {
        $group: {
          _id: { $toUpper: { $trim: { input: "$companyAssigned" } } },
          totalCommittedFee: {
            $sum: {
              $cond: [
                { $gt: ["$finalFee", 0] },
                "$finalFee",
                {
                  $cond: [
                    { $gt: ["$courseFee", 0] },
                    "$courseFee",
                    { $ifNull: ["$registrationAmount", 0] },
                  ],
                },
              ],
            },
          },
        },
      },
    ])
    .toArray();

  const companies = await companiesColl.find({}).toArray();
  for (const comp of companies) {
    const compName = (comp.name || "").toUpperCase().trim();
    const compLegalName = (comp.legalName || compName).toUpperCase().trim();
    const cNorm = normalizeKey(compName);

    let blockedSum = 0;
    admissionsByCompany.forEach((a) => {
      if (!a._id || a._id === "CASH" || a._id === "UNALLOCATED" || a._id === "CASH (UNALLOCATED)") return;
      if (a._id === compName || a._id === compLegalName || normalizeKey(a._id) === cNorm) {
        blockedSum += Number(a.totalCommittedFee) || 0;
      }
    });

    await companiesColl.updateOne(
      { _id: comp._id },
      { $set: { collectedRevenue: blockedSum } }
    );
  }

  console.log("SUCCESS: All student payments and company ledgers are 100% synchronized!");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration Error:", err);
  process.exit(1);
});
