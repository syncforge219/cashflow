import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Company from "@/models/Company";

export async function GET() {
  try {
    await dbConnect();

    const MISSPELLED_LIST = [
      "SP DESIGN GATEWAY TRAINING SERVICES",
      "SP DESIGN GATEEWAY TRAINING SERVICES LLP",
      "SP DESIGN GATEEWAY TRAINING SERVICES",
      "SP DESIGN GATEEWAY TRAINING SERVICE",
      "SP DESIGN GATEWAY TRAINING SERVICE"
    ];
    const CORRECT = "SP DESIGN GATEWAY TRAINING SERVICES LLP";

    // Build a regex pattern to match any of the misspelled/alternate names
    const escapedAlternates = MISSPELLED_LIST.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const matchRegex = new RegExp(`^(?:${escapedAlternates.join('|')})$`, "i");

    // 1. Merge company records if alternate/misspelled ones exist
    let correctCompany = await Company.findOne({
      $or: [
        { name: { $regex: new RegExp(`^${CORRECT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } },
        { legalName: { $regex: new RegExp(`^${CORRECT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, "i") } }
      ]
    });

    if (!correctCompany) {
      correctCompany = await Company.create({
        name: CORRECT,
        legalName: CORRECT,
        status: "ACTIVE",
        brands: ["DESIGN GATEWAY", "CADD MANTRA"]
      });
    }

    const alternateCompanies = await Company.find({
      _id: { $ne: correctCompany._id },
      $or: [
        { name: { $regex: matchRegex } },
        { legalName: { $regex: matchRegex } }
      ]
    });

    let mergedCompanyCount = 0;
    for (const alt of alternateCompanies) {
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
      await Company.deleteOne({ _id: alt._id });
      mergedCompanyCount++;
    }

    // 2. Migrate Admissions with misspelled/alternate company name
    const admissionsToUpdate = await Admission.find({
      $or: [
        { companyAssigned: { $regex: matchRegex } },
        { company: { $regex: matchRegex } }
      ]
    });
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
    }

    // 3. Migrate Payments with misspelled/alternate company name
    const paymentsToUpdate = await Payment.find({
      company: { $regex: matchRegex }
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
