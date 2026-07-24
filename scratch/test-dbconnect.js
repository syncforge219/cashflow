const fs = require("fs");
const path = require("path");

// Load .env manually
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach(line => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      process.env[parts[0].trim()] = parts.slice(1).join("=").trim();
    }
  });
}

const dbConnect = require("../src/lib/db").default;

async function test() {
  try {
    console.log("Calling dbConnect()...");
    await dbConnect();
    console.log("dbConnect SUCCESS!");
    process.exit(0);
  } catch (err) {
    console.error("dbConnect ERROR:", err);
    process.exit(1);
  }
}

test();
