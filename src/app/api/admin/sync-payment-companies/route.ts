import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Admission from "@/models/Admission";
import Payment from "@/models/Payment";
import Company from "@/models/Company";

export async function GET() {
  try {
    await dbConnect();

    // 1. Fetch all admissions and map by ID
    const admissions = await Admission.find({}).lean();
    const admissionMap = new Map<string, any>();
    for (const adm of admissions) {
      admissionMap.set(adm._id.toString(), adm);
    }

    // 2. Fetch all payments
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
          payment.company = admissionCompany;
          await payment.save();

          totalUpdated++;
          updatedDetails.push({
            receiptNo: payment.receiptNo,
            studentName: payment.studentName || admission.fullName,
            paymentMode: payment.paymentMode,
            amount: payment.amountReceived,
            oldCompany: oldComp,
            newCompany: admissionCompany,
          });
        }
      }
    }

    // 3. Reconcile Company Ledgers: Re-sync blocked revenue across all legal entities
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
      message: `Successfully synchronized ${totalUpdated} payment(s) to match student admission company.`,
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
