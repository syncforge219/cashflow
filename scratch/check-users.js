const mongoose = require("mongoose");
const uri = "mongodb://syncforgesolutions_db_user:MySecurePassword12@ac-du9jgwf-shard-00-01.jq4axfo.mongodb.net:27017,ac-du9jgwf-shard-00-00.jq4axfo.mongodb.net:27017,ac-du9jgwf-shard-00-02.jq4axfo.mongodb.net:27017/syncforge_db?ssl=true&authSource=admin&retryWrites=true&w=majority&appName=Cluster0";

async function checkUsers() {
  await mongoose.connect(uri);
  const users = await mongoose.connection.db.collection("users").find({}).toArray();
  console.log("Found users count:", users.length);
  for (let u of users) {
    console.log("User:", { id: u._id, email: u.email, name: u.name, role: u.role, hasPassword: !!u.password });
  }
  await mongoose.disconnect();
}

checkUsers().catch(console.error);
