import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Enquiry from "@/models/Enquiry";
import Admission from "@/models/Admission";
import MarketingSpend from "@/models/MarketingSpend";
import { getMarketingScope, periodFromQuery, sourceKey } from "@/lib/marketingScope";

interface Row {
  key: string;
  label: string;
  spend: number;
  leads: number;
  admissions: number;
  costPerLead: number | null;
  costPerAdmission: number | null;
  conversionPct: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function finish(rows: Map<string, Omit<Row, "costPerLead" | "costPerAdmission" | "conversionPct">>): Row[] {
  return [...rows.values()]
    .map((r) => ({
      ...r,
      spend: round2(r.spend),
      costPerLead: r.leads > 0 ? round2(r.spend / r.leads) : null,
      costPerAdmission: r.admissions > 0 ? round2(r.spend / r.admissions) : null,
      conversionPct: r.leads > 0 ? round2((r.admissions / r.leads) * 100) : null,
    }))
    .sort((a, b) => b.spend - a.spend || b.leads - a.leads);
}

/**
 * Spend vs. leads for the period, by source and by campaign.
 * Admissions are COUNTS of the user's leads that became admissions; no fee or payment amounts.
 */
export async function GET(req: Request) {
  try {
    await dbConnect();
    const { scope, error } = await getMarketingScope(req);
    if (error) return error;
    const period = periodFromQuery(req);

    const [leads, spends] = await Promise.all([
      Enquiry.find({ addedByUserId: { $in: scope!.userIds }, createdAt: { $gte: period.start, $lte: period.end } })
        .select("leadSource utmCampaign status isAdmitted")
        .lean(),
      MarketingSpend.find({ userId: { $in: scope!.userIds }, spendDate: { $gte: period.start, $lte: period.end } })
        .select("source campaign amount")
        .lean(),
    ]);

    // A lead counts as an admission if it is marked admitted or an admission links back to it
    const linked = new Set(
      (await Admission.distinct("enquiryId", { enquiryId: { $in: leads.map((l: any) => l._id) } })).map(String)
    );
    const isConverted = (l: any) =>
      Boolean(l.isAdmitted) ||
      ["admitted", "admission", "converted"].includes(String(l.status || "").toLowerCase()) ||
      linked.has(String(l._id));

    const bySource = new Map<string, any>();
    const byCampaign = new Map<string, any>();
    const bump = (map: Map<string, any>, rawLabel: string, f: (r: any) => void) => {
      const key = sourceKey(rawLabel);
      if (!map.has(key)) map.set(key, { key, label: rawLabel?.trim() || "Unspecified", spend: 0, leads: 0, admissions: 0 });
      f(map.get(key));
    };

    for (const l of leads as any[]) {
      const converted = isConverted(l);
      bump(bySource, l.leadSource, (r) => {
        r.leads++;
        if (converted) r.admissions++;
      });
      if (l.utmCampaign) {
        bump(byCampaign, l.utmCampaign, (r) => {
          r.leads++;
          if (converted) r.admissions++;
        });
      }
    }
    for (const s of spends as any[]) {
      bump(bySource, s.source, (r) => (r.spend += Number(s.amount) || 0));
      if (s.campaign) bump(byCampaign, s.campaign, (r) => (r.spend += Number(s.amount) || 0));
    }

    const sources = finish(bySource);
    const totalSpend = round2(sources.reduce((a, r) => a + r.spend, 0));
    const totalLeads = leads.length;
    const totalAdmissions = (leads as any[]).filter(isConverted).length;

    return NextResponse.json({
      success: true,
      data: {
        period: { from: period.fromKey, to: period.toKey },
        totals: {
          spend: totalSpend,
          leads: totalLeads,
          admissions: totalAdmissions,
          costPerLead: totalLeads > 0 ? round2(totalSpend / totalLeads) : null,
          costPerAdmission: totalAdmissions > 0 ? round2(totalSpend / totalAdmissions) : null,
          conversionPct: totalLeads > 0 ? round2((totalAdmissions / totalLeads) * 100) : null,
        },
        bySource: sources,
        byCampaign: finish(byCampaign),
      },
    });
  } catch (err: any) {
    console.error("[marketing/summary]", err);
    return NextResponse.json({ success: false, error: "Failed to load summary" }, { status: 500 });
  }
}
