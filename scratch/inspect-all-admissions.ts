import dbConnect from "../src/lib/db";
import Admission from "../src/models/Admission";
import Payment from "../src/models/Payment";
import Company from "../src/models/Company";

async function main() {
  await dbConnect();

  console.log("=== ALL ADMISSIONS ===");
  const allAdms = await Admission.find({}).lean();
  console.log(allAdms.map((a: any) => ({
    _id: a._id,
    admissionId: a.admissionId,
    fullName: a.fullName || a.studentFullName,
    brand: a.brand,
    companyAssigned: a.companyAssigned,
    paymentMode: a.paymentMode,
    totalFee: a.totalFee,
    finalFee: a.finalFee,
    paidAmount: a.paidAmount,
    balanceDue: a.balanceDue
  })));

  console.log("\n=== ALL PAYMENTS ===");
  const allPayments = await Payment.find({}).lean();
  console.log(allPayments.map((p: any) => ({
    _id: p._id,
    receiptNo: p.receiptNo,
    admissionId: p.admissionId,
    studentName: p.studentName,
    amount: p.amount,
    paymentMode: p.paymentMode,
    mode: p.mode,
    company: p.company,
    companyAssigned: p.companyAssigned,
    brand: p.brand,
    createdAt: p.createdAt
  })));

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
