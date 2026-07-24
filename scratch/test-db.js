const mongoose = require("mongoose");

const uri = "mongodb://syncforgesolutions_db_user:MySecurePassword12@ac-du9jgwf-shard-00-01.jq4axfo.mongodb.net:27017,ac-du9jgwf-shard-00-00.jq4axfo.mongodb.net:27017,ac-du9jgwf-shard-00-02.jq4axfo.mongodb.net:27017/syncforge_db?ssl=true&authSource=admin&retryWrites=true&w=majority&appName=Cluster0";

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  name: String,
  role: String,
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

async function testFullFlow() {
  console.time("totalTime");
  console.time("connectTime");
  try {
    const opts = {
      bufferCommands: false,
      family: 4,
    };
    await mongoose.connect(uri, opts);
    console.timeEnd("connectTime");

    console.time("findOneTime");
    const user = await User.findOne({ email: "test@example.com" });
    console.timeEnd("findOneTime");
    console.log("User found:", user);

    console.timeEnd("totalTime");
    await mongoose.disconnect();
  } catch (err) {
    console.timeEnd("totalTime");
    console.error("Error in flow:", err);
  }
}

testFullFlow();
