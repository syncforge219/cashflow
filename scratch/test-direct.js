const mongoose = require("mongoose");

const uri = "mongodb://syncforgesolutions_db_user:MySecurePassword12@ac-du9jgwf-shard-00-00.jq4axfo.mongodb.net:27017,ac-du9jgwf-shard-00-01.jq4axfo.mongodb.net:27017,ac-du9jgwf-shard-00-02.jq4axfo.mongodb.net:27017/syncforge_db?ssl=true&replicaSet=atlas-9xnd89-shard-0&authSource=admin&retryWrites=true&w=majority";

async function test() {
  console.log("Testing DIRECT connection string without custom DNS...");
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("DIRECT CONNECTION SUCCESSFUL!");
    await mongoose.disconnect();
  } catch (err) {
    console.error("DIRECT CONNECTION FAILED:", err);
  }
}

test();
