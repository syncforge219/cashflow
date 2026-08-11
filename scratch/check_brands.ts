process.env.DISABLE_CRON = "true";
import dbConnect from "../src/lib/db";
import Payment from "../src/models/Payment";
import Admission from "../src/models/Admission";
import mongoose from "mongoose";

async function run() {
  await dbConnect();
  console.log("Connected to DB.");

  const compWithLlp = "SP DESIGN GATEWAY TRAINING SERVICES LLP";
  const compWithoutLlp = "SP DESIGN GATEWAY TRAINING SERVICES";

  // Admissions
  const admWithLlp = await Admission.find({ companyAssigned: compWithLlp }).lean();
  console.log(`\nAdmissions with "${compWithLlp}":`);
  admWithLlp.forEach((a: any) => console.log(`- Student: ${a.fullName} | Brand: "${a.brand}"`));

  const admWithoutLlp = await Admission.find({ companyAssigned: compWithoutLlp }).lean();
  console.log(`\nAdmissions with "${compWithoutLlp}":`);
  admWithoutLlp.forEach((a: any) => console.log(`- Student: ${a.fullName} | Brand: "${a.brand}"`));

  // Let's also look at all Users
  const User = mongoose.model("User");
  const users = await User.find({}).lean();
  console.log("\n=== USERS ===");
  users.forEach((u: any) => {
    console.log(`- User: ${u.username || u.email} | Brand: "${u.brand}" | BrandScope: "${u.brandScope}"`);
  });

  process.exit(0);
}

run().catch(console.error);
