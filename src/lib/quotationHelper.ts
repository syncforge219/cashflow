import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import QuotationProfile from "@/models/QuotationProfile";
import QuotationCounter from "@/models/QuotationCounter";

import { getFinancialYear, getFinancialYearRange } from "@/lib/financialYearHelper";
export { getFinancialYear, getFinancialYearRange };

export function formatQuotationNumber(
  input: string,
  prefix: string = "QTN",
  customDate?: Date
): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  if (/^\d+$/.test(trimmed)) {
    const fy = getFinancialYear(customDate || new Date());
    const seq = trimmed.padStart(4, "0");
    const p = prefix || "QTN";
    return `${p}/${fy}/${seq}`;
  }
  return trimmed;
}

export async function generateQuotationNumber(
  companyId: string = "DEFAULT_COMPANY",
  customDate?: Date,
  session?: mongoose.ClientSession | null
): Promise<string> {
  await dbConnect();
  const profQuery = QuotationProfile.findOne({ companyId });
  if (session) profQuery.session(session);
  let profile = await profQuery.lean();
  if (!profile) {
    if (session) {
      const created = await QuotationProfile.create([{ companyId }], { session });
      profile = created[0].toObject();
    } else {
      profile = await QuotationProfile.create({ companyId });
    }
  }

  const p = (profile as any)?.prefix;
  const prefix = p || "QTN";
  const fy = getFinancialYear(customDate || new Date());

  const counterOptions: any = { new: true, upsert: true };
  if (session) {
    counterOptions.session = session;
  }

  const counterDoc = await QuotationCounter.findOneAndUpdate(
    { companyId, financialYear: fy },
    { $inc: { seq: 1 } },
    counterOptions
  );

  const seqFormatted = String((counterDoc as any)?.seq || 1).padStart(4, "0");
  return `${prefix}/${fy}/${seqFormatted}`;
}
