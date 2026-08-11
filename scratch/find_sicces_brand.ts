process.env.DISABLE_CRON = "true";
import dbConnect from "../src/lib/db";
import mongoose from "mongoose";

async function run() {
  await dbConnect();
  console.log("Connected.");

  const db = mongoose.connection.db;
  const companies = await db.collection("companies").find({
    name: /SICCES/i
  }).toArray();

  console.log("Raw Company Documents from MongoDB Driver:", JSON.stringify(companies, null, 2));
  process.exit(0);
}

run().catch(console.error);
