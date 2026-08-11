process.env.DISABLE_CRON = "true";
import dbConnect from "../src/lib/db";
import Payment from "../src/models/Payment";
import Company from "../src/models/Company";
import Admission from "../src/models/Admission";

async function run() {
  await dbConnect();
  console.log("Connected to MongoDB successfully.");

  const MERGE_GROUPS = [
    {
      correct: "SP DESIGN GATEWAY TRAINING SERVICES LLP",
      alternates: [
        "SP DESIGN GATEWAY TRAINING SERVICES",
        "SP DESIGN GATEEWAY TRAINING SERVICES LLP",
        "SP DESIGN GATEEWAY TRAINING SERVICES",
        "SP DESIGN GATEEWAY TRAINING SERVICE",
        "SP DESIGN GATEWAY TRAINING SERVICE"
      ],
      brands: ["DESIGN GATEWAY", "CADD MANTRA"]
    },
    {
      correct: "SICCES PRIVATE LIMITED",
      alternates: [
        "SICCES PVT LTD",
        "SICCES PRIVATE LTD",
        "SICCES PVT LIMITED"
      ],
      brands: ["DESIGN GATEWAY", "DIGIFOOTPRINTS", "CADD MANTRA"]
    }
  ];

  let totalMergedCompanyCount = 0;
  let totalAdmissionsMigrated = 0;
  let totalPaymentsMigrated = 0;

  for (const group of MERGE_GROUPS) {
    const CORRECT = group.correct;
    const MISSPELLED_LIST = group.alternates;

    // Build a regex pattern to match any of the misspelled/alternate names
    const escapedAlternates = MISSPELLED_LIST.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const matchRegex = new RegExp(`^(?:${escapedAlternates.join('|')})$`, "i");

    console.log(`\n=== MERGING COMPANY RECORDS (Alternates -> "${CORRECT}") ===`);
    
    // Find correct company record
    let correctCompany = await Company.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${CORRECT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } },
        { legalName: { $regex: new RegExp(`^${CORRECT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } }
      ]
    });

    if (!correctCompany) {
      console.log(`Correct company record "${CORRECT}" not found. Creating one...`);
      correctCompany = await Company.create({
        name: CORRECT,
        legalName: CORRECT,
        status: "ACTIVE",
        brands: group.brands
      });
    } else {
      // Merge group brands into existing
      const existingBrands = correctCompany.brands || [];
      const combinedBrands = Array.from(new Set([...existingBrands, ...group.brands]));
      correctCompany.brands = combinedBrands;
      await correctCompany.save();
    }

    // Find all alternate/misspelled company records
    const alternateCompanies = await Company.find({
      _id: { $ne: correctCompany._id },
      $or: [
        { name: { $regex: matchRegex } },
        { legalName: { $regex: matchRegex } }
      ]
    });

    console.log(`Found ${alternateCompanies.length} alternate/misspelled company record(s) for "${CORRECT}".`);
    for (const alt of alternateCompanies) {
      console.log(`Merging alternate company record: ID=${alt._id}, Name="${alt.name}"`);
      
      // Merge brands list
      const mergedBrands = Array.from(
        new Set([
          ...(correctCompany.brands || []),
          ...(alt.brands || [])
        ])
      );
      correctCompany.brands = mergedBrands;
      
      // Keep max capacity or sum capacity
      correctCompany.annualCapacityCap = Math.max(
        correctCompany.annualCapacityCap || 0,
        alt.annualCapacityCap || 0
      );

      await correctCompany.save();
      
      // Delete the alternate company record
      await Company.deleteOne({ _id: alt._id });
      totalMergedCompanyCount++;
      console.log(`Deleted alternate company record.`);
    }

    console.log(`\n=== UPDATING ADMISSIONS (Alternates -> "${CORRECT}") ===`);
    const admissionsToUpdate = await Admission.find({
      $or: [
        { companyAssigned: { $regex: matchRegex } },
        { company: { $regex: matchRegex } }
      ]
    });

    console.log(`Found ${admissionsToUpdate.length} admission(s) with alternate/misspelled company.`);
    let admUpdatedCount = 0;
    for (const adm of admissionsToUpdate) {
      const isAssignedMatched = adm.companyAssigned && MISSPELLED_LIST.some(m => adm.companyAssigned?.trim().toUpperCase() === m.toUpperCase());
      if (isAssignedMatched) {
        adm.companyAssigned = CORRECT;
      }
      const legacyCompany = adm.get("company");
      const isLegacyMatched = legacyCompany && typeof legacyCompany === "string" && MISSPELLED_LIST.some(m => legacyCompany.trim().toUpperCase() === m.toUpperCase());
      if (isLegacyMatched) {
        adm.set("company", CORRECT, { strict: false });
      }
      await adm.save();
      admUpdatedCount++;
      totalAdmissionsMigrated++;
      console.log(`Updated Admission ID=${adm._id} | Student: ${adm.fullName}`);
    }
    console.log(`Successfully updated ${admUpdatedCount} admission record(s).`);

    console.log(`\n=== UPDATING PAYMENTS (Alternates -> "${CORRECT}") ===`);
    const paymentsToUpdate = await Payment.find({
      company: { $regex: matchRegex }
    });

    console.log(`Found ${paymentsToUpdate.length} payment(s) with alternate/misspelled company.`);
    let payUpdatedCount = 0;
    for (const p of paymentsToUpdate) {
      p.company = CORRECT;
      await p.save();
      payUpdatedCount++;
      totalPaymentsMigrated++;
      console.log(`Updated Payment ID=${p._id} | Receipt: ${p.receiptNo || p.referenceNo}`);
    }
    console.log(`Successfully updated ${payUpdatedCount} payment record(s).`);
  }

  console.log(`\n=== RECONCILING AND ALIGNING ALL STUDENT PAYMENTS TO THEIR ADMISSION COMPANIES ===`);
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

  console.log(`\n=== RECONCILING COMPANY LEDGER CAPACITIES ===`);
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
