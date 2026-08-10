import dbConnect from "../src/lib/db";
import Company from "../src/models/Company";
import Admission from "../src/models/Admission";
import Payment from "../src/models/Payment";

async function main() {
  await dbConnect();

  console.log("=== ALL COMPANIES ===");
  const companies = await Company.find({}).lean();
  console.log(JSON.stringify(companies.map((c: any) => ({
    _id: c._id,
    companyId: c.companyId,
    name: c.name,
    legalName: c.legalName,
    annualCapacityCap: c.annualCapacityCap,
    collectedRevenue: c.collectedRevenue,
    brands: c.brands,
    status: c.status
  })), null, 2));

  console.log("\n=== ADMISSIONS (SALMAAN, MOIZ, or ID 43/44) ===");
  const admissions = await Admission.find({
    $or: [
      { admissionId: { $regex: /43|44/i } },
      { fullName: { $regex: /salmaan|moiz/i } },
      { studentFullName: { $regex: /salmaan|moiz/i } }
    ]
  }).lean();
  console.log(JSON.stringify(admissions.map((a: any) => ({
    _id: a._id,
    admissionId: a.admissionId,
    fullName: a.fullName || a.studentFullName,
    course: a.course,
    brand: a.brand,
    companyAssigned: a.companyAssigned,
    totalFee: a.totalFee,
    finalFee: a.finalFee,
    paidAmount: a.paidAmount,
    balanceDue: a.balanceDue,
    paymentMode: a.paymentMode,
    paymentType: a.paymentType,
    customEmiPlan: a.customEmiPlan
  })), null, 2));

  console.log("\n=== PAYMENTS FOR THESE STUDENTS / COMPANIES ===");
  const payments = await Payment.find({
    $or: [
      { studentName: { $regex: /salmaan|moiz/i } },
      { company: { $in: ["SICCES PVT LTD", "SLING SHOT TECHNOLOGIES"] } }
    ]
  }).lean();
  console.log(JSON.stringify(payments.map((p: any) => ({
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
    date: p.date,
    createdAt: p.createdAt
  })), null, 2));

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
