const mongoose = require("mongoose");
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const srvUri = "mongodb+srv://syncforgesolutions_db_user:MySecurePassword12@cluster0.jq4axfo.mongodb.net/syncforge_db?retryWrites=true&w=majority&appName=Cluster0";

async function test() {
  try {
    const conn = await mongoose.connect(srvUri, { serverSelectionTimeoutMS: 10000 });
    console.log("SRV Connection successful!");
    console.log("Host:", conn.connection.host);
    console.log("Port:", conn.connection.port);
    console.log("Name:", conn.connection.name);
    console.log("Client topology servers:", Array.from(conn.connection.client.topology.s.servers.keys()));
    await mongoose.disconnect();
  } catch (err) {
    console.error("SRV Connection error:", err);
  }
}

test();
