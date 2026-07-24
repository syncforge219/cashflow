const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const srvUri = "mongodb+srv://syncforgesolutions_db_user:MySecurePassword12@cluster0.jq4axfo.mongodb.net/syncforge_db?retryWrites=true&w=majority&appName=Cluster0";

async function test() {
  try {
    console.log("Testing connection to cluster0.jq4axfo.mongodb.net...");
    await mongoose.connect(srvUri, { serverSelectionTimeoutMS: 5000 });
    console.log("SUCCESSFULLY CONNECTED TO MONGODB!");
    await mongoose.disconnect();
  } catch (err) {
    console.error("Connection failed:", err.message);
  }
}

test();
