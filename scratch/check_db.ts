process.env.DISABLE_CRON = "true";
import dbConnect from "../src/lib/db";
import Payment from "../src/models/Payment";
import Admission from "../src/models/Admission";
import Company from "../src/models/Company";

async function run() {
  await dbConnect();
  console.log("Connected to DB.");

  // 1. All Companies
  const companies = await Company.find({}).lean();
  console.log("\n=== ALL COMPANIES ===");
  companies.forEach(c => {
    console.log(`- ID: ${c._id} | Name: "${c.name}" | LegalName: "${c.legalName}" | Blocked: ${c.collectedRevenue || c.blockedAmount}`);
  });

  // 2. Unique companyAssigned/company in Admissions
  const admissions = await Admission.find({}).lean();
  const uniqueAdmAssigned = new Set<string>();
  const uniqueAdmCompany = new Set<string>();
  admissions.forEach((a: any) => {
    if (a.companyAssigned) uniqueAdmAssigned.add(a.companyAssigned);
    if (a.company) uniqueAdmCompany.add(a.company);
  });
  console.log("\n=== UNIQUE ADMISSION companyAssigned ===");
  console.log(Array.from(uniqueAdmAssigned));
  console.log("\n=== UNIQUE ADMISSION company (legacy) ===");
  console.log(Array.from(uniqueAdmCompany));

  // 3. Unique company in Payments
  const payments = await Payment.find({}).lean();
  const uniquePayCompany = new Set<string>();
  payments.forEach((p: any) => {
    if (p.company) uniquePayCompany.add(p.company);
  });
  console.log("\n=== UNIQUE PAYMENT company ===");
  console.log(Array.from(uniquePayCompany));

  // 4. Count Admissions matching the correct company spelling
  const targetCompany = "SP DESIGN GATEWAY TRAINING SERVICES LLP";
  const admWithGateway = admissions.filter((a: any) => 
    (a.companyAssigned && a.companyAssigned.toUpperCase() === targetCompany.toUpperCase()) ||
    (a.company && a.company.toUpperCase() === targetCompany.toUpperCase())
  );
  console.log(`\n=== ADMISSIONS MATCHING "${targetCompany}" ===`);
  console.log(`Count: ${admWithGateway.length}`);
  admWithGateway.slice(0, 5).forEach((a: any) => {
    console.log(`- ID: ${a._id} | Student: ${a.fullName} | companyAssigned: "${a.companyAssigned}" | company: "${a.company}"`);
  });

  // 5. Count Payments matching the correct company spelling
  const payWithGateway = payments.filter((p: any) => 
    p.company && p.company.toUpperCase() === targetCompany.toUpperCase()
  );
  console.log(`\n=== PAYMENTS MATCHING "${targetCompany}" ===`);
  console.log(`Count: ${payWithGateway.length}`);
  payWithGateway.slice(0, 5).forEach((p: any) => {
    console.log(`- ID: ${p._id} | ReceiptNo: ${p.receiptNo} | Student: ${p.studentName} | company: "${p.company}" | paymentMode: "${p.paymentMode}"`);
  });

  process.exit(0);
}

run().catch(console.error);
