const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const hostList = "ac-vps6m2f-shard-00-02.cs7ct9s.mongodb.net:27017,ac-vps6m2f-shard-00-00.cs7ct9s.mongodb.net:27017,ac-vps6m2f-shard-00-01.cs7ct9s.mongodb.net:27017";
const pass = "qiLG7nlTIDgKzQ0t";

const usernames = [
  "syncforgesolutions_db_user",
  "syncforge_db_user",
  "syncforgesolutions",
  "syncforge",
  "admin",
  "cashflow"
];

async function run() {
  for (const u of usernames) {
    const uri = `mongodb://${u}:${encodeURIComponent(pass)}@${hostList}/syncforge_db?ssl=true&authSource=admin&retryWrites=true&w=majority`;
    console.log(`Testing username '${u}'...`);
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
      console.log(`\n\n>>>>>>>> SUCCESS WITH USERNAME: '${u}' <<<<<<<<\n\n`);
      await mongoose.disconnect();
      return u;
    } catch (err) {
      console.log(`Failed for '${u}': ${err.message}`);
    }
  }
}

run();
