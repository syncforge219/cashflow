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
  const uri = await resolveMongoUri(rawUri);
  console.log("Connecting with IPv4...");
  await mongoose.connect(uri, {
    bufferCommands: false,
    serverSelectionTimeoutMS: 10000,
    family: 4,
  });
  console.log("Connected successfully.");

  const db = mongoose.connection.db;
  const admissionsColl = db.collection("admissions");
  const paymentsColl = db.collection("payments");

  const admissions = await admissionsColl.find({}).toArray();
  const admissionMap = new Map();
  for (const adm of admissions) {
    admissionMap.set(adm._id.toString(), adm);
  }

  const payments = await paymentsColl.find({}).toArray();
  console.log(`Total Payments found: ${payments.length}`);

  let mismatches = 0;
  for (const p of payments) {
    const adm = p.admissionId ? admissionMap.get(p.admissionId.toString()) : null;
    const admComp = adm ? (adm.companyAssigned || adm.company || "").trim().toUpperCase() : "";
    const pComp = (p.company || "").trim().toUpperCase();

    if (
      adm &&
      admComp &&
      admComp !== "CASH" &&
      admComp !== "UNALLOCATED" &&
      admComp !== "CASH (UNALLOCATED)" &&
      admComp !== "AUTO"
    ) {
      if (pComp !== admComp) {
        mismatches++;
        console.log(
          `MISMATCH: Receipt ${p.receiptNo || p._id} | Student: ${p.studentName || adm.fullName} | Mode: ${p.paymentMode} | Payment Company: "${pComp}" -> Admission Company: "${admComp}"`
        );
        await paymentsColl.updateOne(
          { _id: p._id },
          { $set: { company: admComp } }
        );
      }
    }
  }

  console.log(`\nSynchronization complete: ${mismatches} payment(s) updated to match admission company.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Inspect Error:", err);
  process.exit(1);
});
