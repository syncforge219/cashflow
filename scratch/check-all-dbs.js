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
  const conn = await mongoose.connect(resolved);

  const adminDb = mongoose.connection.db.admin();
  const dbs = await adminDb.listDatabases();
  console.log("Databases on cluster:", dbs.databases.map(d => d.name));

  for (const d of dbs.databases) {
    if (["admin", "local"].includes(d.name)) continue;
    const currentDb = conn.connection.client.db(d.name);
    const cols = await currentDb.listCollections().toArray();
    for (const c of cols) {
      const sample = await currentDb.collection(c.name).find({
        $or: [
          { studentFullName: /salmaan|moiz/i },
          { fullName: /salmaan|moiz/i },
          { name: /salmaan|moiz/i },
          { admissionId: /43|44/i }
        ]
      }).toArray();
      if (sample.length > 0) {
        console.log(`FOUND in DB "${d.name}", collection "${c.name}":`, JSON.stringify(sample, null, 2));
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
