import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ServiceInvoice from "@/models/ServiceInvoice";
import ClientReceipt from "@/models/ClientReceipt";
import { requireBillingUser, badRequest, isObjectId, errorResponse } from "@/lib/billingServer";
import { getPrintBankDetails } from "@/lib/billingDocs";

/** One invoice with its receipts and print bank details. Invoices are locked: there is no PUT or DELETE. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await params;
    if (!isObjectId(id)) return badRequest("Invalid invoice id");

    const invoice: any = await ServiceInvoice.findById(id).lean();
    if (!invoice) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });

    // A tax invoice's money was received against its PI
    const receiptQuery = invoice.piId ? { piId: invoice.piId } : { invoiceId: invoice._id };
    const [receipts, bank] = await Promise.all([
      ClientReceipt.find(receiptQuery).sort({ receiptDate: 1 }).lean(),
      getPrintBankDetails(invoice.companyId),
    ]);
    return NextResponse.json({ success: true, data: { ...invoice, receipts, bank } });
  } catch (error: any) {
    return errorResponse(error, "Failed to load invoice");
  }
}
