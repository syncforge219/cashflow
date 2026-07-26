const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("No MONGODB_URI found in .env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);

  const UserSchema = new mongoose.Schema({}, { strict: false });
  const User = mongoose.models.User || mongoose.model("User", UserSchema);

  const cleanEmail = "finance@coachflow.com";
  const hashedPassword = await bcrypt.hash("finance123", 10);

  const existing = await User.findOne({ email: cleanEmail });
  if (existing) {
    existing.password = hashedPassword;
    existing.role = "finance manager";
    existing.brandScope = "All Brands";
    await existing.save();
    console.log("Updated Finance Manager user: finance@coachflow.com / finance123");
  } else {
    await User.create({
      name: "Chief Finance Officer",
      email: cleanEmail,
      password: hashedPassword,
      role: "finance manager",
      brandScope: "All Brands",
      joiningDate: new Date(),
    });
    console.log("Created new Finance Manager user: finance@coachflow.com / finance123");
  }

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
