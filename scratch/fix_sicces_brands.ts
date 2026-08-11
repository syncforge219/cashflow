process.env.DISABLE_CRON = "true";
import dbConnect from "../src/lib/db";
import mongoose from "mongoose";

async function run() {
  await dbConnect();
  console.log("Connected.");

  const db = mongoose.connection.db;

  // Find all companies with the name SICCES PRIVATE LIMITED
  const companies = await db.collection("companies").find({ name: /^SICCES PRIVATE LIMITED$/i }).toArray();
  console.log(`Found ${companies.length} company document(s) named SICCES PRIVATE LIMITED:`);
  for (const c of companies) {
    console.log(`  _id: ${c._id} | companyId: ${c.companyId} | brands: ${JSON.stringify(c.brands)} | createdAt: ${c.createdAt}`);
  }

  // Fix ALL of them - set brands to exactly the three correct ones
  const result = await db.collection("companies").updateMany(
    { name: /^SICCES PRIVATE LIMITED$/i },
    { $set: { brands: ["DESIGN GATEWAY", "DIGIFOOTPRINTS", "CADD MANTRA"] } }
  );
  console.log(`\nFixed ${result.modifiedCount} document(s). All SICCES PRIVATE LIMITED entries now have correct brands.`);
  process.exit(0);
}

run().catch(console.error);
