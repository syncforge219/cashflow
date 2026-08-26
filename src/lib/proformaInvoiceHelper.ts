import dbConnect from "@/lib/db";
import QuotationProfile from "@/models/QuotationProfile";
import ProformaInvoiceCounter from "@/models/ProformaInvoiceCounter";
import { getFinancialYear } from "@/lib/quotationHelper";

export async function generateProformaInvoiceNumber(companyId: string = "DEFAULT_COMPANY", customDate?: Date): Promise<string> {
  await dbConnect();
  let profile = await QuotationProfile.findOne({ companyId }).lean();
  if (!profile) {
    profile = await QuotationProfile.create({ companyId });
  }

  const prefix = (profile as any).prefix || "PI";
  const piPrefix = prefix === "APPL" ? "PI" : `${prefix}-PI`;
  const fy = getFinancialYear(customDate || new Date());

  const counterDoc = await ProformaInvoiceCounter.findOneAndUpdate(
    { companyId, financialYear: fy },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seqFormatted = String(counterDoc.seq).padStart(4, "0");
  return `${piPrefix}/${fy}/${seqFormatted}`;
}
