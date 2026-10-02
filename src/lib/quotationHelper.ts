import dbConnect from "@/lib/db";
import QuotationProfile from "@/models/QuotationProfile";
import QuotationCounter from "@/models/QuotationCounter";

import { getFinancialYear, getFinancialYearRange } from "@/lib/financialYearHelper";
export { getFinancialYear, getFinancialYearRange };

export function formatQuotationNumber(
  input: string,
  prefix: string = "SICCES",
  customDate?: Date
): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  if (/^\d+$/.test(trimmed)) {
    const fy = getFinancialYear(customDate || new Date());
    const seq = trimmed.padStart(4, "0");
    const p = prefix && prefix !== "APPL" ? prefix : "SICCES";
    return `${p}/${fy}/${seq}`;
  }
  return trimmed;
}

export async function generateQuotationNumber(companyId: string = "DEFAULT_COMPANY", customDate?: Date): Promise<string> {
  await dbConnect();
  let profile = await QuotationProfile.findOne({ companyId }).lean();
  if (!profile) {
    profile = await QuotationProfile.create({ companyId });
  }

  const p = (profile as any)?.prefix;
  const prefix = p && p !== "APPL" ? p : "SICCES";
  const fy = getFinancialYear(customDate || new Date());

  const counterDoc = await QuotationCounter.findOneAndUpdate(
    { companyId, financialYear: fy },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seqFormatted = String(counterDoc.seq).padStart(4, "0");
  return `${prefix}/${fy}/${seqFormatted}`;
}
