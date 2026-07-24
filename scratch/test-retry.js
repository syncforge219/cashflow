const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const hostList = "ac-vps6m2f-shard-00-02.cs7ct9s.mongodb.net:27017,ac-vps6m2f-shard-00-00.cs7ct9s.mongodb.net:27017,ac-vps6m2f-shard-00-01.cs7ct9s.mongodb.net:27017";

const uris = [
  `mongodb://syncforgesolutions_db_user:qiLG7nlTIDgKzQ0t@${hostList}/syncforge_db?ssl=true&authSource=admin&retryWrites=true&w=majority`,
  `mongodb://syncforgesolutions_db_user:qiLG7nlTIDgKzQ0t@${hostList}/admin?ssl=true&authSource=admin&retryWrites=true&w=majority`,
  `mongodb+srv://syncforgesolutions_db_user:qiLG7nlTIDgKzQ0t@cluster0.cs7ct9s.mongodb.net/?retryWrites=true&w=majority`,
];

async function run() {
  for (let i = 0; i < uris.length; i++) {
    console.log(`Retry ${i+1}:`, uris[i]);
    try {
      await mongoose.connect(uris[i], { serverSelectionTimeoutMS: 5000 });
      console.log(`>>> RETRY ${i+1} SUCCESSFUL! <<<`);
      await mongoose.disconnect();
      return true;
    } catch (err) {
      console.error(`Retry ${i+1} failed:`, err.message);
    }
  }
  return false;
}

run();
