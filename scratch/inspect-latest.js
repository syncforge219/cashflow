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

async function main() {
  const resolved = await resolveMongoUri(process.env.MONGODB_URI);
  await mongoose.connect(resolved);
  const db = mongoose.connection.db;

  // 1. All admissions — full detail
  console.log("=== ALL ADMISSIONS (sorted by admissionId) ===");
  const admissions = await db.collection("admissions").find({}).sort({ admissionId: 1 }).toArray();
  console.log(`Total: ${admissions.length}`);
  for (const a of admissions) {
    console.log(JSON.stringify({
      _id: a._id, admissionId: a.admissionId, fullName: a.fullName,
      mobile: a.mobileNumber, brand: a.brand, company: a.companyAssigned,
      paymentMode: a.paymentMode, finalFee: a.finalFee,
      registrationAmount: a.registrationAmount, amountReceivedToday: a.amountReceivedToday,
      remainingBalance: a.remainingBalance
    }));
  }

  // 2. Payments for SICCES and SLING SHOT
  console.log("\n=== PAYMENTS for SICCES PVT LTD ===");
  const sicces = await db.collection("payments").find({ company: "SICCES PVT LTD" }).sort({ createdAt: 1 }).toArray();
  for (const p of sicces) {
    console.log(JSON.stringify({
      _id: p._id, receiptNo: p.receiptNo, admissionId: p.admissionId,
      student: p.studentName, amount: p.amount, mode: p.paymentMode, company: p.company,
      brand: p.brand, date: p.createdAt
    }));
  }

  console.log("\n=== PAYMENTS for SLING SHOT TECHNOLOGIES ===");
  const sling = await db.collection("payments").find({ company: "SLING SHOT TECHNOLOGIES" }).sort({ createdAt: 1 }).toArray();
  for (const p of sling) {
    console.log(JSON.stringify({
      _id: p._id, receiptNo: p.receiptNo, admissionId: p.admissionId,
      student: p.studentName, amount: p.amount, mode: p.paymentMode, company: p.company,
      brand: p.brand, date: p.createdAt
    }));
  }

  // 3. Company docs
  console.log("\n=== COMPANY: SICCES PVT LTD ===");
  const sComp = await db.collection("companies").findOne({ name: "SICCES PVT LTD" });
  console.log(JSON.stringify(sComp, null, 2));

  console.log("\n=== COMPANY: SLING SHOT TECHNOLOGIES ===");
  const slComp = await db.collection("companies").findOne({ name: "SLING SHOT TECHNOLOGIES" });
  console.log(JSON.stringify(slComp, null, 2));

  await mongoose.disconnect();
}

main().catch(console.error);
