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

  // Get full payment details for SICCES and SLING SHOT first entries
  console.log("=== FULL PAYMENT DETAILS for SICCES PVT LTD (first entry) ===");
  const sicces1 = await db.collection("payments").findOne({ _id: new mongoose.Types.ObjectId("6a633db6a95e567b0050d629") });
  console.log(JSON.stringify(sicces1, null, 2));

  console.log("\n=== FULL ADMISSION for Ujjwal Singhal (ADM000006) ===");
  const adm6 = await db.collection("admissions").findOne({ _id: new mongoose.Types.ObjectId("6a633db3a95e567b0050d628") });
  console.log(JSON.stringify(adm6, null, 2));

  console.log("\n=== FULL PAYMENT DETAILS for SLING SHOT (first entry) ===");
  const sling1 = await db.collection("payments").findOne({ _id: new mongoose.Types.ObjectId("6a6593cfb054a079237a94ca") });
  console.log(JSON.stringify(sling1, null, 2));

  console.log("\n=== FULL ADMISSION for Chaitanya Singhal (ADM000009) ===");
  const adm9 = await db.collection("admissions").findOne({ _id: new mongoose.Types.ObjectId("6a6593cfb054a079237a94c9") });
  console.log(JSON.stringify(adm9, null, 2));

  await mongoose.disconnect();
}

main().catch(console.error);
