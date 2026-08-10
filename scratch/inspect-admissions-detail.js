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

  const admissions = await db.collection("admissions").find({}).toArray();
  for (const a of admissions) {
    console.log({
      _id: a._id.toString(),
      admissionId: a.admissionId,
      fullName: a.fullName || a.studentFullName,
      mobileNumber: a.mobileNumber || a.phone,
      brand: a.brand,
      companyAssigned: a.companyAssigned,
      paymentMode: a.paymentMode,
      paymentType: a.paymentType,
      paidAmount: a.paidAmount,
      balanceDue: a.balanceDue,
      finalFee: a.finalFee,
      totalFee: a.totalFee
    });
  }

  await mongoose.disconnect();
}

main().catch(console.error);
