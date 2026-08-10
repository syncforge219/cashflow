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

  const collections = await db.listCollections().toArray();
  console.log("Collections:", collections.map(c => c.name));

  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`${col.name}: ${count} documents`);
    const sample = await db.collection(col.name).find({
      $or: [
        { studentFullName: /salmaan|moiz/i },
        { fullName: /salmaan|moiz/i },
        { name: /salmaan|moiz/i },
        { admissionId: /43|44/i }
      ]
    }).toArray();
    if (sample.length > 0) {
      console.log(`FOUND IN ${col.name}:`, JSON.stringify(sample, null, 2));
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
