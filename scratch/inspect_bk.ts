process.env.DISABLE_CRON = "true";
import dbConnect from "../src/lib/db";
import Payment from "../src/models/Payment";
import Admission from "../src/models/Admission";

async function run() {
  await dbConnect();
  console.log("Connected to DB.");

  const p = await Payment.findOne({ receiptNo: "REC-2026-00022" }).lean();
  console.log("\n=== bk PAYMENT ===");
  console.log(JSON.stringify(p, null, 2));

  if (p && p.admissionId) {
    const a = await Admission.findById(p.admissionId).lean();
    console.log("\n=== bk ADMISSION ===");
    console.log(JSON.stringify(a, null, 2));
  }

  process.exit(0);
}

run().catch(console.error);
