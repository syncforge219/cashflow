const mongoose = require("mongoose");
const dns = require("dns");

async function resolveMongoUri(srvUri) {
  if (!srvUri.startsWith("mongodb+srv://")) return srvUri;

  try {
    dns.setServers(["8.8.8.8", "1.1.1.1"]);
  } catch (e) {}

  const match = srvUri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/([^?]+)\?(.*)$/);
  if (!match) return srvUri;

  const [, user, pass, host, dbName, queryParams] = match;
  const srvDomain = `_mongodb._tcp.${host}`;

  try {
    const records = await new Promise((resolve, reject) => {
      dns.resolveSrv(srvDomain, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });

    const hostList = records.map(r => `${r.name}:${r.port}`).join(",");
    const directUri = `mongodb://${user}:${encodeURIComponent(pass)}@${hostList}/${dbName}?ssl=true&authSource=admin&${queryParams}`;
    console.log("Resolved direct URI:", directUri);
    return directUri;
  } catch (err) {
    console.warn("SRV Resolution failed, using original URI:", err.message);
    return srvUri;
  }
}

async function test() {
  const srvUri = "mongodb+srv://syncforgesolutions_db_user:MySecurePassword12@cluster0.jq4axfo.mongodb.net/syncforge_db?retryWrites=true&w=majority&appName=Cluster0";
  const finalUri = await resolveMongoUri(srvUri);
  
  try {
    await mongoose.connect(finalUri, { serverSelectionTimeoutMS: 5000 });
    console.log("SUCCESSFULLY CONNECTED TO MONGODB!");
    await mongoose.disconnect();
  } catch (err) {
    console.error("Connection failed:", err.message);
  }
}

test();
