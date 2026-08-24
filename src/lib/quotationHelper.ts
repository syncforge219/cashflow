import dbConnect from "@/lib/db";
import QuotationProfile from "@/models/QuotationProfile";
import QuotationCounter from "@/models/QuotationCounter";

export function getFinancialYear(dateInput: Date = new Date()): string {
  const year = dateInput.getFullYear();
  const month = dateInput.getMonth() + 1; // 1-12
  if (month >= 4) {
    const nextYear = String(year + 1).slice(-2);
    return `${year}-${nextYear}`;
  } else {
    const prevYear = year - 1;
    const currYear = String(year).slice(-2);
    return `${prevYear}-${currYear}`;
  }
}

export async function generateQuotationNumber(companyId: string = "DEFAULT_COMPANY", customDate?: Date): Promise<string> {
  await dbConnect();
  let profile = await QuotationProfile.findOne({ companyId }).lean();
  if (!profile) {
    profile = await QuotationProfile.create({ companyId });
  }

  const prefix = (profile as any).prefix || "APPL";
  const fy = getFinancialYear(customDate || new Date());

  const counterDoc = await QuotationCounter.findOneAndUpdate(
    { companyId, financialYear: fy },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seqFormatted = String(counterDoc.seq).padStart(4, "0");
  return `${prefix}/${fy}/${seqFormatted}`;
}
