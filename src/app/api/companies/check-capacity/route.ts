import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Company from "@/models/Company";
import { sendWhatsAppCompanyLimit80Alert } from "@/lib/msg91";

/**
 * GET & POST /api/companies/check-capacity
 * Scans all legal companies for capacity usage.
 * If a company reaches or exceeds 80% of its annual capacity limit (and hasn't been alerted yet),
 * sends an MSG91 WhatsApp alert using template "limit" ONLY to Super Admin.
 */
export async function GET() {
  return handleCapacityCheck();
}

export async function POST() {
  return handleCapacityCheck();
}

import { getFinancialYearRange } from "@/lib/financialYearHelper";
import Admission from "@/models/Admission";

async function handleCapacityCheck() {
  try {
    await dbConnect();
    const fyRange = getFinancialYearRange();
    const companies = await Company.find({ status: "ACTIVE" });

    // Aggregate admissions for current financial year (1st April - 31st March)
    const admissionsByCompany = await Admission.aggregate([
      {
        $match: {
          $or: [
            { admissionDate: { $gte: fyRange.startDate, $lte: fyRange.endDate } },
            { $and: [{ admissionDate: { $exists: false } }, { createdAt: { $gte: fyRange.startDate, $lte: fyRange.endDate } }] },
            { $and: [{ admissionDate: null }, { createdAt: { $gte: fyRange.startDate, $lte: fyRange.endDate } }] }
          ]
        }
      },
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

    let checked = 0;
    let alertsSent = 0;
    const details: any[] = [];

    for (const comp of companies) {
      checked++;
      const compName = (comp.name || "").toUpperCase().trim();
      const compLegal = (comp.legalName || compName).toUpperCase().trim();
      const cNorm = normalizeKey(compName);

      let cycleCommitted = 0;
      admissionsByCompany.forEach((a: any) => {
        if (!a._id || a._id === "CASH" || a._id === "UNALLOCATED" || a._id === "CASH (UNALLOCATED)") return;
        if (a._id === compName || a._id === compLegal || normalizeKey(a._id) === cNorm) {
          cycleCommitted += Number(a.totalCommittedFee) || 0;
        }
      });

      const isNewFiscalYear = comp.currentFinancialYear !== fyRange.label;
      if (isNewFiscalYear) {
        comp.currentFinancialYear = fyRange.label;
        comp.alerted80Percent = false;
      }
      comp.collectedRevenue = cycleCommitted;
      await comp.save();

      const cap = comp.annualCapacityCap || 1949999;
      const pct = cap > 0 ? (cycleCommitted / cap) * 100 : 0;

      if (pct >= 80 && !comp.alerted80Percent) {
        const result = await sendWhatsAppCompanyLimit80Alert({
          companyName: comp.name,
        });

        if (result.success) {
          alertsSent++;
          (comp as any).alerted80Percent = true;
          await comp.save();

          details.push({
            company: comp.name,
            financialYear: fyRange.label,
            capacityPercentage: `${pct.toFixed(1)}%`,
            status: "WhatsApp 80% Limit Alert Sent to Super Admin",
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      checkedCompanies: checked,
      alertsSent,
      details,
    });
  } catch (error: any) {
    console.error("Error in company capacity check API:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to check company capacity" },
      { status: 500 }
    );
  }
}
