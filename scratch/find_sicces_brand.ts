process.env.DISABLE_CRON = "true";
import dbConnect from "../src/lib/db";
import mongoose from "mongoose";

async function run() {
  await dbConnect();
  console.log("Connected.");

  const db = mongoose.connection.db;

  // List all brand documents and their companies arrays
  const brands = await db.collection("brands").find({}).toArray();
  for (const b of brands) {
    console.log(`\nBrand: "${b.name}" (code: ${b.code})`);
    console.log(`  Companies: ${JSON.stringify(b.companies)}`);
  }
  process.exit(0);
}

run().catch(console.error);
