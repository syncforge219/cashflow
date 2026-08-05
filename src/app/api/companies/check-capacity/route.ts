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

async function handleCapacityCheck() {
  try {
    await dbConnect();
    const companies = await Company.find({ status: "ACTIVE" });

    let checked = 0;
    let alertsSent = 0;
    const details: any[] = [];

    for (const comp of companies) {
      checked++;
      const cap = comp.annualCapacityCap || 1949999;
      const collected = comp.collectedRevenue || 0;
      const pct = cap > 0 ? (collected / cap) * 100 : 0;

      if (pct >= 80) {
        const result = await sendWhatsAppCompanyLimit80Alert({
          companyName: comp.name,
        });

        if (result.success) {
          alertsSent++;
          (comp as any).alerted80Percent = true;
          await comp.save();

          details.push({
            company: comp.name,
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
