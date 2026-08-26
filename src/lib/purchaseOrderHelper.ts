import dbConnect from "@/lib/db";
import QuotationProfile from "@/models/QuotationProfile";
import PurchaseOrderCounter from "@/models/PurchaseOrderCounter";
import { getFinancialYear } from "@/lib/quotationHelper";

export async function generatePurchaseOrderNumber(companyId: string = "DEFAULT_COMPANY", customDate?: Date): Promise<string> {
  await dbConnect();
  let profile = await QuotationProfile.findOne({ companyId }).lean();
  if (!profile) {
    profile = await QuotationProfile.create({ companyId });
  }

  const prefix = (profile as any).prefix || "PO";
  const poPrefix = prefix === "APPL" ? "PO" : `${prefix}-PO`;
  const fy = getFinancialYear(customDate || new Date());

  const counterDoc = await PurchaseOrderCounter.findOneAndUpdate(
    { companyId, financialYear: fy },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seqFormatted = String(counterDoc.seq).padStart(4, "0");
  return `${poPrefix}/${fy}/${seqFormatted}`;
}
