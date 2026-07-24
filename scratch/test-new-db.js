const mongoose = require("mongoose");
const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const user = "syncforgesolutions_db_user";
const pass = "qiLG7nlTIDgKzQ0t";
const host = "cluster0.cs7ct9s.mongodb.net";
const dbName = "syncforge_db";

const srvDomain = `_mongodb._tcp.${host}`;
console.log("Resolving SRV for:", srvDomain);

dns.resolveSrv(srvDomain, async (err, addresses) => {
  if (err) {
    console.error("SRV Resolution failed:", err);
    return;
  }
  console.log("SRV Addresses:", JSON.stringify(addresses, null, 2));

  const hostList = addresses.map(r => `${r.name}:${r.port}`).join(",");
  const directUri = `mongodb://${user}:${encodeURIComponent(pass)}@${hostList}/${dbName}?ssl=true&authSource=admin&retryWrites=true&w=majority`;
  console.log("\nDirect URI:", directUri);

  try {
    console.log("Connecting to new MongoDB database...");
    await mongoose.connect(directUri, { serverSelectionTimeoutMS: 5000 });
    console.log("NEW DATABASE CONNECTION SUCCESSFUL!");
    await mongoose.disconnect();
  } catch (connectErr) {
    console.error("Connection failed:", connectErr);
  }
});
