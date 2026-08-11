process.env.DISABLE_CRON = "true";
import dbConnect from "../src/lib/db";
import Payment from "../src/models/Payment";
import Company from "../src/models/Company";
import Admission from "../src/models/Admission";

async function run() {
  await dbConnect();
  console.log("Connected to MongoDB successfully.");

  const MISSPELLED = "SP DESIGN GATEEWAY TRAINING SERVICES LLP";
  const CORRECT = "SP DESIGN GATEWAY TRAINING SERVICES LLP";

  console.log(`\n=== STEP 1: MERGING COMPANY RECORDS ("${MISSPELLED}" -> "${CORRECT}") ===`);
  
  const misspelledCompany = await Company.findOne({
    $or: [
      { name: { $regex: new RegExp(`^${MISSPELLED.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } },
      { legalName: { $regex: new RegExp(`^${MISSPELLED.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } }
    ]
  });

  const correctCompany = await Company.findOne({
    $or: [
      { name: { $regex: new RegExp(`^${CORRECT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } },
      { legalName: { $regex: new RegExp(`^${CORRECT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } }
    ]
  });

  if (misspelledCompany) {
    console.log(`Found misspelled company record: ID=${misspelledCompany._id}, Name="${misspelledCompany.name}"`);
    if (correctCompany) {
      console.log(`Found correct company record: ID=${correctCompany._id}, Name="${correctCompany.name}". Merging...`);
      
      // Merge brands list
      const mergedBrands = Array.from(
        new Set([
          ...(correctCompany.brands || []),
          ...(misspelledCompany.brands || [])
        ])
      );
      correctCompany.brands = mergedBrands;
      
      // Keep max capacity or sum capacity
      correctCompany.annualCapacityCap = Math.max(
        correctCompany.annualCapacityCap || 0,
        misspelledCompany.annualCapacityCap || 0
      );

      await correctCompany.save();
      
      // Delete the misspelled company record
      await Company.deleteOne({ _id: misspelledCompany._id });
      console.log(`Deleted misspelled company record and updated correct company brands/capacity.`);
    } else {
      console.log(`Correct company record not found. Renaming misspelled company record to "${CORRECT}"...`);
      misspelledCompany.name = CORRECT;
      misspelledCompany.legalName = CORRECT;
      await misspelledCompany.save();
      console.log("Misspelled company renamed successfully.");
    }
  } else {
    console.log("No misspelled company record found in Company collection.");
  }

  console.log(`\n=== STEP 2: UPDATING ADMISSIONS ("${MISSPELLED}" -> "${CORRECT}") ===`);
  const admRegex = new RegExp(`^${MISSPELLED.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i");
  
  const admissionsToUpdate = await Admission.find({
    $or: [
      { companyAssigned: { $regex: admRegex } },
      { company: { $regex: admRegex } }
    ]
  });

  console.log(`Found ${admissionsToUpdate.length} admission(s) with misspelled company.`);
  let admUpdatedCount = 0;
  for (const adm of admissionsToUpdate) {
    if (adm.companyAssigned && adm.companyAssigned.trim().toUpperCase() === MISSPELLED.toUpperCase()) {
      adm.companyAssigned = CORRECT;
    }
    const legacyCompany = adm.get("company");
    if (legacyCompany && typeof legacyCompany === "string" && legacyCompany.trim().toUpperCase() === MISSPELLED.toUpperCase()) {
      adm.set("company", CORRECT, { strict: false });
    }
    await adm.save();
    admUpdatedCount++;
    console.log(`Updated Admission ID=${adm._id} | Student: ${adm.fullName}`);
  }
  console.log(`Successfully updated ${admUpdatedCount} admission record(s).`);

  console.log(`\n=== STEP 3: UPDATING PAYMENTS ("${MISSPELLED}" -> "${CORRECT}") ===`);
  const paymentsToUpdate = await Payment.find({
    company: { $regex: admRegex }
  });

  console.log(`Found ${paymentsToUpdate.length} payment(s) with misspelled company.`);
  let payUpdatedCount = 0;
  for (const p of paymentsToUpdate) {
    p.company = CORRECT;
    await p.save();
    payUpdatedCount++;
    console.log(`Updated Payment ID=${p._id} | Receipt: ${p.receiptNo || p.referenceNo}`);
  }
  console.log(`Successfully updated ${payUpdatedCount} payment record(s).`);

  console.log(`\n=== STEP 4: RECONCILING AND ALIGNING ALL STUDENT PAYMENTS TO THEIR ADMISSION COMPANIES ===`);
  // 1. Map all admissions by ID
  const admissionsList = await Admission.find({}).lean();
  const admissionMap = new Map<string, any>();
  for (const adm of admissionsList) {
    admissionMap.set(adm._id.toString(), adm);
  }

  // 2. Scan all payments
  const payments = await Payment.find({});
  let totalPaymentsSynced = 0;

  for (const p of payments) {
    if (!p.admissionId) continue;
    const adm = admissionMap.get(p.admissionId.toString());
    if (!adm) continue;

    const admComp = (adm.companyAssigned || adm.company || "").trim().toUpperCase();
    if (
      admComp &&
      admComp !== "CASH" &&
      admComp !== "UNALLOCATED" &&
      admComp !== "CASH (UNALLOCATED)" &&
      admComp !== "AUTO" &&
      admComp !== "SELECT COMPANY..."
    ) {
      const curComp = (p.company || "").trim().toUpperCase();
      // If payment is not Cash and its company does not match its student's admission company
      if (p.paymentMode?.toLowerCase() !== "cash" && curComp !== admComp) {
        console.log(
          `[ALIGN] Payment ${p.receiptNo || p._id} | Student: ${p.studentName || adm.fullName} | Mode: ${p.paymentMode} | Mismatch aligned: "${curComp}" -> "${admComp}"`
        );
        p.company = adm.companyAssigned || adm.company;
        await p.save();
        totalPaymentsSynced++;
      }
    }
  }
  console.log(`Aligned ${totalPaymentsSynced} payment record(s) with their student's correct admission company.`);

  console.log(`\n=== STEP 5: RECONCILING COMPANY LEDGER CAPACITIES ===`);
  const normalizeKey = (n: string) =>
    (n || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .replace(/PRIVATELIMITED/g, "PVTLTD")
      .replace(/PVTLIMITED/g, "PVTLTD")
      .replace(/LIMITED/g, "LTD")
      .replace(/SERVICES/g, "")
      .replace(/GATEEWAY/g, "GATEWAY")
      .replace(/INSTITUTE/g, "INSTITUE")
      .replace(/LLP/g, "");

  const admissionsByCompany = await Admission.aggregate([
    {
      $group: {
        _id: { $toUpper: { $trim: { input: "$companyAssigned" } } },
        totalCommittedFee: {
          $sum: {
            $cond: [
              { $gt: ["$finalFee", 0] },
              "$finalFee",
              {
                $cond: [
                  { $gt: ["$courseFee", 0] },
                  "$courseFee",
                  { $ifNull: ["$registrationAmount", 0] }
                ]
              }
            ]
          }
        }
      }
    }
  ]);

  const allCompanies = await Company.find({});
  for (const comp of allCompanies) {
    const compName = (comp.name || "").toUpperCase().trim();
    const compLegalName = (comp.legalName || compName).toUpperCase().trim();
    const cNorm = normalizeKey(compName);

    let blockedSum = 0;
    admissionsByCompany.forEach((a: any) => {
      if (!a._id || a._id === "CASH" || a._id === "UNALLOCATED" || a._id === "CASH (UNALLOCATED)") return;
      if (a._id === compName || a._id === compLegalName || normalizeKey(a._id) === cNorm) {
        blockedSum += Number(a.totalCommittedFee) || 0;
      }
    });

    console.log(`Reconciled company capacity: "${comp.name}" | Blocked Revenue: ₹${comp.collectedRevenue} -> ₹${blockedSum}`);
    comp.collectedRevenue = blockedSum;
    await comp.save();
  }

  console.log("\nSUCCESS: All data migrated, payments aligned to admission companies, and ledger capacities recalculated!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
