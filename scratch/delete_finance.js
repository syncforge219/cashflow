const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

// Read .env file manually
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf8");
  envText.split("\n").forEach(line => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
      process.env[key] = val;
    }
  });
}

async function removeFinanceUser() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("No MONGODB_URI found in .env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB to remove auto-created finance user...");
  await mongoose.connect(uri);

  const UserSchema = new mongoose.Schema({}, { strict: false });
  const User = mongoose.models.User || mongoose.model("User", UserSchema);

  const result = await User.deleteMany({ email: "finance@coachflow.com" });
  console.log("Deleted finance@coachflow.com count:", result.deletedCount);

  await mongoose.disconnect();
}

removeFinanceUser().catch(err => {
  console.error("Delete error:", err);
  process.exit(1);
});
