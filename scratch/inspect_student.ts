import dbConnect from "../src/lib/db";
import Payment from "../src/models/Payment";
import Admission from "../src/models/Admission";

async function run() {
  await dbConnect();
  console.log("Connected to DB successfully.");

  const payments = await Payment.find({ admissionId: { $exists: true } }).populate("admissionId").lean();
  console.log(`Checking ${payments.length} populated payments...`);

  let countMismatched = 0;
  for (const p of payments) {
    if (!p.admissionId) continue;
    const adm: any = p.admissionId;

    const admComp = (adm.companyAssigned || adm.company || "").trim().toUpperCase();
    const curComp = (p.company || "").trim().toUpperCase();
    const pMode = (p.paymentMode || "").trim().toLowerCase();

    if (
      admComp &&
      admComp !== "CASH" &&
      admComp !== "UNALLOCATED" &&
      admComp !== "CASH (UNALLOCATED)" &&
      admComp !== "AUTO" &&
      admComp !== "SELECT COMPANY..."
    ) {
      if (pMode !== "cash" && curComp !== admComp) {
        countMismatched++;
        console.log(`MISMATCH [${countMismatched}]:`, {
          paymentId: p._id,
          receiptNo: p.receiptNo,
          studentName: p.studentName || adm.fullName,
          paymentMode: p.paymentMode,
          paymentCompany: p.company,
          admissionCompany: adm.companyAssigned || adm.company,
        });
      }
    }
  }

  console.log(`Total mismatched non-cash payments found: ${countMismatched}`);
  process.exit(0);
}

run().catch(console.error);
