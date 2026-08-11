process.env.DISABLE_CRON = "true";
import dbConnect from "../src/lib/db";
import Payment from "../src/models/Payment";
import Admission from "../src/models/Admission";
import Company from "../src/models/Company";

async function run() {
  await dbConnect();
  console.log("Connected to DB successfully.");

  // Check companies with GATEEWAY
  const companies = await Company.find({
    $or: [
      { name: /GATEEWAY/i },
      { legalName: /GATEEWAY/i }
    ]
  }).lean();
  console.log("Companies with GATEEWAY:", companies);

  // Check admissions with GATEEWAY
  const admissions = await Admission.find({
    $or: [
      { companyAssigned: /GATEEWAY/i },
      { company: /GATEEWAY/i }
    ]
  }).lean();
  console.log("Admissions with GATEEWAY:", admissions.map((a: any) => ({
    _id: a._id,
    fullName: a.fullName,
    companyAssigned: a.companyAssigned,
    company: a.company
  })));

  // Check payments with GATEEWAY
  const payments = await Payment.find({ company: /GATEEWAY/i }).lean();
  console.log("Payments with GATEEWAY:", payments.map(p => ({
    _id: p._id,
    receiptNo: p.receiptNo,
    studentName: p.studentName,
    company: p.company
  })));

  process.exit(0);
}

run().catch(console.error);
