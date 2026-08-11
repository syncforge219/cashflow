process.env.DISABLE_CRON = "true";
import dbConnect from "../src/lib/db";
import Payment from "../src/models/Payment";
import Admission from "../src/models/Admission";
import Company from "../src/models/Company";

async function run() {
  await dbConnect();
  console.log("Connected to DB.");

  const compWithLlp = "SP DESIGN GATEWAY TRAINING SERVICES LLP";
  const compWithoutLlp = "SP DESIGN GATEWAY TRAINING SERVICES";

  console.log("\n=== COMPANIES ===");
  const c1 = await Company.findOne({ name: compWithLlp }).lean();
  console.log(`With LLP: Name="${c1?.name}" | LegalName="${c1?.legalName}" | Blocked=${c1?.collectedRevenue}`);
  const c2 = await Company.findOne({ name: compWithoutLlp }).lean();
  console.log(`Without LLP: Name="${c2?.name}" | LegalName="${c2?.legalName}" | Blocked=${c2?.collectedRevenue}`);

  // Admissions
  const admWithLlp = await Admission.find({ companyAssigned: compWithLlp }).lean();
  console.log(`\nAdmissions with "${compWithLlp}": ${admWithLlp.length}`);
  admWithLlp.forEach((a: any) => console.log(`- ID: ${a._id} | Student: ${a.fullName} | FinalFee: ${a.finalFee} | CourseFee: ${a.courseFee}`));

  const admWithoutLlp = await Admission.find({ companyAssigned: compWithoutLlp }).lean();
  console.log(`\nAdmissions with "${compWithoutLlp}": ${admWithoutLlp.length}`);
  admWithoutLlp.forEach((a: any) => console.log(`- ID: ${a._id} | Student: ${a.fullName} | FinalFee: ${a.finalFee} | CourseFee: ${a.courseFee}`));

  // Payments
  const payWithLlp = await Payment.find({ company: compWithLlp }).lean();
  console.log(`\nPayments with "${compWithLlp}": ${payWithLlp.length}`);
  payWithLlp.forEach((p: any) => console.log(`- ID: ${p._id} | ReceiptNo: ${p.receiptNo} | Student: ${p.studentName} | Amount: ${p.amountReceived}`));

  const payWithoutLlp = await Payment.find({ company: compWithoutLlp }).lean();
  console.log(`\nPayments with "${compWithoutLlp}": ${payWithoutLlp.length}`);
  payWithoutLlp.forEach((p: any) => console.log(`- ID: ${p._id} | ReceiptNo: ${p.receiptNo} | Student: ${p.studentName} | Amount: ${p.amountReceived}`));

  process.exit(0);
}

run().catch(console.error);
