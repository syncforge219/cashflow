import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Company from "@/models/Company";

export async function GET() {
  try {
    await dbConnect();

    const MISSPELLED = "SP DESIGN GATEEWAY TRAINING SERVICES LLP";
    const CORRECT = "SP DESIGN GATEWAY TRAINING SERVICES LLP";

    // 1. Merge company records if misspelled one exists
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

    let mergedCompanyCount = 0;
    if (misspelledCompany) {
      if (correctCompany) {
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
        await Company.deleteOne({ _id: misspelledCompany._id });
        mergedCompanyCount++;
      } else {
        misspelledCompany.name = CORRECT;
        misspelledCompany.legalName = CORRECT;
        await misspelledCompany.save();
        mergedCompanyCount++;
      }
    }

    // 2. Migrate Admissions with misspelled company name
    const admRegex = new RegExp(`^${MISSPELLED.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i");
    const admissionsToUpdate = await Admission.find({
      $or: [
        { companyAssigned: { $regex: admRegex } },
        { company: { $regex: admRegex } }
      ]
    });
    for (const adm of admissionsToUpdate) {
      if (adm.companyAssigned && adm.companyAssigned.trim().toUpperCase() === MISSPELLED.toUpperCase()) {
        adm.companyAssigned = CORRECT;
      }
      const legacyCompany = adm.get("company");
      if (legacyCompany && typeof legacyCompany === "string" && legacyCompany.trim().toUpperCase() === MISSPELLED.toUpperCase()) {
        adm.set("company", CORRECT, { strict: false });
      }
      await adm.save();
    }

    // 3. Migrate Payments with misspelled company name
    const paymentsToUpdate = await Payment.find({
      company: { $regex: admRegex }
    });
    for (const p of paymentsToUpdate) {
      p.company = CORRECT;
      await p.save();
    }

    // 4. Fetch all admissions and map by ID
    const admissions = await Admission.find({}).lean();
    const admissionMap = new Map<string, any>();
    for (const adm of admissions) {
      admissionMap.set(adm._id.toString(), adm);
    }

    // 5. Fetch all payments and align
    const payments = await Payment.find({});
    let totalUpdated = 0;
    const updatedDetails: any[] = [];

    for (const payment of payments) {
      if (!payment.admissionId) continue;

      const admission = admissionMap.get(payment.admissionId.toString());
      if (!admission) continue;

      const admissionCompany = (admission.companyAssigned || admission.company || "").trim().toUpperCase();

      // Only update if admission has a valid legal company assigned
      if (
        admissionCompany &&
        admissionCompany !== "CASH" &&
        admissionCompany !== "UNALLOCATED" &&
        admissionCompany !== "CASH (UNALLOCATED)" &&
        admissionCompany !== "AUTO" &&
        admissionCompany !== "SELECT COMPANY..."
      ) {
        // If payment mode is not Cash and company differs from admission company
        const currentPaymentCompany = (payment.company || "").trim().toUpperCase();

        if (payment.paymentMode?.toLowerCase() !== "cash" && currentPaymentCompany !== admissionCompany) {
          const oldComp = payment.company;
          payment.company = admission.companyAssigned || admission.company; // keep original case/legal casing
          await payment.save();

          totalUpdated++;
          updatedDetails.push({
            receiptNo: payment.receiptNo,
            studentName: payment.studentName || admission.fullName,
            paymentMode: payment.paymentMode,
            amount: payment.amountReceived,
            oldCompany: oldComp,
            newCompany: payment.company,
          });
        }
      }
    }

    // 6. Reconcile Company Ledgers: Re-sync blocked revenue across all legal entities
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

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${totalUpdated} payment(s) to match student admission company, merged misspelled company, and migrated associated records.`,
      mergedCompanyCount,
      admissionsMigrated: admissionsToUpdate.length,
      paymentsMigrated: paymentsToUpdate.length,
      totalPaymentsChecked: payments.length,
      totalPaymentsUpdated: totalUpdated,
      updatedPayments: updatedDetails,
    });
  } catch (error: any) {
    console.error("Sync Payment Companies Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to synchronize payment companies" },
      { status: 500 }
    );
  }
}
