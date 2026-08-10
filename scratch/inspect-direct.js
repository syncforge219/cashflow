const mongoose = require("mongoose");
const dns = require("node:dns");

async function resolveMongoUri(uri) {
  if (!uri || !uri.startsWith("mongodb+srv://")) return uri;
  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (e) {}
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
      const hostList = records.map(r => `${r.name}:${r.port}`).join(",");
      return `mongodb://${user}:${encodeURIComponent(pass)}@${hostList}/${dbName}?ssl=true&authSource=admin&${queryParams}`;
    }
  } catch (err) {}
  return uri;
}

async function main() {
  const rawUri = process.env.MONGODB_URI;
  const resolved = await resolveMongoUri(rawUri);
  await mongoose.connect(resolved);

  const db = mongoose.connection.db;

  console.log("=== ALL COLLECTIONS ===");
  const collections = await db.listCollections().toArray();
  console.log(collections.map(c => c.name));

  console.log("\n=== ALL ADMISSIONS ===");
  const admissions = await db.collection("admissions").find({}).toArray();
  console.log(`Total Admissions: ${admissions.length}`);
  console.log(JSON.stringify(admissions.map(a => ({
    _id: a._id,
    admissionId: a.admissionId,
    fullName: a.fullName || a.studentFullName,
    course: a.course,
    brand: a.brand,
    companyAssigned: a.companyAssigned,
    paymentMode: a.paymentMode,
    totalFee: a.totalFee,
    finalFee: a.finalFee,
    paidAmount: a.paidAmount,
    balanceDue: a.balanceDue
  })), null, 2));

  console.log("\n=== ALL PAYMENTS ===");
  const payments = await db.collection("payments").find({}).toArray();
  console.log(`Total Payments: ${payments.length}`);
  console.log(JSON.stringify(payments.map(p => ({
    _id: p._id,
    receiptNo: p.receiptNo,
    admissionId: p.admissionId,
    studentName: p.studentName,
    amount: p.amount,
    paymentMode: p.paymentMode,
    mode: p.mode,
    company: p.company,
    companyAssigned: p.companyAssigned,
    brand: p.brand
  })), null, 2));

  console.log("\n=== ALL COMPANIES ===");
  const companies = await db.collection("companies").find({}).toArray();
  console.log(JSON.stringify(companies.map(c => ({
    _id: c._id,
    companyId: c.companyId,
    name: c.name,
    legalName: c.legalName,
    annualCapacityCap: c.annualCapacityCap,
    collectedRevenue: c.collectedRevenue,
    brands: c.brands,
    status: c.status
  })), null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
