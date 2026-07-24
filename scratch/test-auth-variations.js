const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const hostList = "ac-vps6m2f-shard-00-02.cs7ct9s.mongodb.net:27017,ac-vps6m2f-shard-00-00.cs7ct9s.mongodb.net:27017,ac-vps6m2f-shard-00-01.cs7ct9s.mongodb.net:27017";

const variations = [
  "mongodb+srv://syncforgesolutions_db_user:qiLG7nlTIDgKzQ0t@cluster0.cs7ct9s.mongodb.net/syncforge_db?retryWrites=true&w=majority",
  "mongodb+srv://syncforgesolutions_db_user:qiLG7nlTIDgKzQ0t@cluster0.cs7ct9s.mongodb.net/admin?retryWrites=true&w=majority",
  "mongodb+srv://syncforgesolutions_db_user:MySecurePassword12@cluster0.cs7ct9s.mongodb.net/syncforge_db?retryWrites=true&w=majority",
  `mongodb://syncforgesolutions_db_user:qiLG7nlTIDgKzQ0t@${hostList}/syncforge_db?ssl=true&authSource=admin&retryWrites=true&w=majority`,
  `mongodb://syncforgesolutions_db_user:qiLG7nlTIDgKzQ0t@${hostList}/syncforge_db?ssl=true&authSource=syncforge_db&retryWrites=true&w=majority`,
];

async function run() {
  for (let i = 0; i < variations.length; i++) {
    const uri = variations[i];
    console.log(`\nTesting variation ${i+1}:`, uri);
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log(`>>> VARIATION ${i+1} SUCCESS! <<<`);
      await mongoose.disconnect();
      return uri;
    } catch (err) {
      console.error(`Variation ${i+1} failed:`, err.message);
    }
  }
}

run();
