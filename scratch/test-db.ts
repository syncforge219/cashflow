import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "node:dns";

dotenv.config({ path: ".env.local" });

console.log("MONGODB_URI:", process.env.MONGODB_URI);

async function test() {
  try {
    console.log("Attempting connection without custom DNS first...");
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log("SUCCESS without custom DNS!");
    await mongoose.disconnect();
  } catch (err) {
    console.error("FAILED without custom DNS:", err);
  }

  try {
    console.log("\nAttempting connection WITH custom DNS (8.8.8.8)...");
    try {
      dns.setServers(["8.8.8.8", "1.1.1.1"]);
    } catch(e) {
      console.warn("dns.setServers error:", e);
    }
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log("SUCCESS with custom DNS!");
    await mongoose.disconnect();
  } catch (err) {
    console.error("FAILED with custom DNS:", err);
  }
}

test();
