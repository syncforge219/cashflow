const mongoose = require("mongoose");

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/coachflow?directConnection=true");
  
  const db = mongoose.connection.db;
  
  console.log("=== COMPANIES ===");
  const companies = await db.collection("companies").find({}).toArray();
  console.log(JSON.stringify(companies.map(c => ({
    _id: c._id,
    companyId: c.companyId,
    name: c.name,
    legalName: c.legalName,
    annualCapacityCap: c.annualCapacityCap,
    collectedRevenue: c.collectedRevenue,
    brands: c.brands,
    status: c.status
  })), null, 2));

  console.log("\n=== ADMISSIONS (SALMAAN & MOIZ & RECENT) ===");
  const admissions = await db.collection("admissions").find({
    $or: [
      { admissionId: "ADM000044" },
      { admissionId: "ADM000043" },
      { fullName: { $regex: /salmaan|moiz/i } },
      { studentFullName: { $regex: /salmaan|moiz/i } }
    ]
  }).toArray();
  console.log(JSON.stringify(admissions.map(a => ({
    _id: a._id,
    admissionId: a.admissionId,
    fullName: a.fullName,
    course: a.course,
    brand: a.brand,
    companyAssigned: a.companyAssigned,
    totalFee: a.totalFee,
    finalFee: a.finalFee,
    paidAmount: a.paidAmount,
    balanceDue: a.balanceDue,
    paymentMode: a.paymentMode
  })), null, 2));

  console.log("\n=== PAYMENTS (FOR THESE ADMISSIONS) ===");
  const admIds = admissions.map(a => a._id);
  const admIdStrings = admissions.map(a => a._id.toString());
  const admCodes = admissions.map(a => a.admissionId);
  const payments = await db.collection("payments").find({
    $or: [
      { admissionId: { $in: [...admIds, ...admIdStrings, ...admCodes] } },
      { studentName: { $regex: /salmaan|moiz/i } }
    ]
  }).toArray();
  console.log(JSON.stringify(payments.map(p => ({
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

  await mongoose.disconnect();
}

check().catch(console.error);
