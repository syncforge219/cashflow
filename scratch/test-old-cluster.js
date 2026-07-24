const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

async function test() {
  const uri = "mongodb+srv://syncforgesolutions_db_user:qiLG7nlTIDgKzQ0t@cluster0.jq4axfo.mongodb.net/syncforge_db?retryWrites=true&w=majority";
  console.log("Testing password qiLG7nlTIDgKzQ0t on cluster0.jq4axfo.mongodb.net...");
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log(">>> SUCCESS ON cluster0.jq4axfo.mongodb.net <<<");
    await mongoose.disconnect();
  } catch (err) {
    console.error("Failed:", err.message);
  }
}

test();
