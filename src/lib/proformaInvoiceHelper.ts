import mongoose from "mongoose";
import dbConnect from "@/lib/db";
import QuotationProfile from "@/models/QuotationProfile";
import ProformaInvoiceCounter from "@/models/ProformaInvoiceCounter";
import { getFinancialYear } from "@/lib/quotationHelper";

export async function generateProformaInvoiceNumber(
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

  const prefix = (profile as any).prefix || "PI";
  const piPrefix = prefix === "APPL" ? "PI" : `${prefix}-PI`;
  const fy = getFinancialYear(customDate || new Date());

  const counterOptions: any = { new: true, upsert: true };
  if (session) {
    counterOptions.session = session;
  }

  const counterDoc = await ProformaInvoiceCounter.findOneAndUpdate(
    { companyId, financialYear: fy },
    { $inc: { seq: 1 } },
    counterOptions
  );

  const seqFormatted = String((counterDoc as any)?.seq || 1).padStart(4, "0");
  return `${piPrefix}/${fy}/${seqFormatted}`;
}
