import dbConnect from "../src/lib/db";

import Payment from "../src/models/Payment";
import Company from "../src/models/Company";
import Admission from "../src/models/Admission";

async function run() {
  await dbConnect();
  console.log("Connected to MongoDB successfully.");

  // 1. Map all admissions by ID
  const admissions = await Admission.find({}).lean();
  const admissionMap = new Map<string, any>();
  for (const adm of admissions) {
    admissionMap.set(adm._id.toString(), adm);
  }

  // 2. Scan all payments
  const payments = await Payment.find({});
  let totalUpdated = 0;

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
      if (p.paymentMode?.toLowerCase() !== "cash" && curComp !== admComp) {
        console.log(
          `[SYNC] Payment ${p.receiptNo || p._id} | Student: ${p.studentName || adm.fullName} | Mode: ${p.paymentMode} | Changed: "${curComp}" -> "${admComp}"`
        );
        p.company = admComp;
        await p.save();
        totalUpdated++;
      }
    }
  }

  console.log(`Updated ${totalUpdated} payment record(s).`);

  // 3. Reconcile Company Ledgers
  console.log("Reconciling Company Ledgers...");
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

  const companies = await Company.find({});
  for (const comp of companies) {
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

    comp.collectedRevenue = blockedSum;
    await comp.save();
  }

  console.log("SUCCESS: All payments and company ledgers are completely synchronized!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
