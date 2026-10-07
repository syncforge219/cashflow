import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ServiceInvoice from "@/models/ServiceInvoice";
import { requireBillingUser, badRequest, isObjectId, errorResponse } from "@/lib/billingServer";
import { BillingError, loadBillingParties, nextDocNumber, requireDate, requirePeriod, rupeesToPaiseStrict } from "@/lib/billingDocs";
import { computeTax } from "@/lib/billingTax";
import { BUSINESS_TYPES } from "@/lib/billing";
import { withOptionalTransaction } from "@/lib/transactionHelper";
import { logAuditEntry } from "@/lib/auditLogger";
import { escapeRegex } from "@/lib/helper";
import { istDayRange, toDateKey } from "@/lib/dates";

/** Lists tax and Non-GST invoices. ?pending=1 returns Non-GST invoices not fully paid (for receipt entry). */
export async function GET(req: Request) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const query: any = {};
    if (searchParams.get("pending") === "1") {
      query.invoiceType = "NON_GST_INVOICE";
      query.paymentStatus = { $in: ["UNPAID", "PARTIALLY_PAID"] };
    } else if (searchParams.get("type")) {
      query.invoiceType = searchParams.get("type");
    }
    for (const key of ["clientId", "companyId"] as const) {
      const v = searchParams.get(key);
      if (v) {
        if (!isObjectId(v)) return badRequest(`Invalid ${key}`);
        query[key] = v;
      }
    }
    const from = toDateKey(searchParams.get("from"));
    const to = toDateKey(searchParams.get("to"));
    if (from || to) query.invoiceDate = { $gte: istDayRange(from || "2000-01-01").start, $lte: istDayRange(to || "2100-01-01").end };
    const q = (searchParams.get("q") || "").trim();
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      query.$or = [{ invoiceNumber: rx }, { piNumber: rx }, { "client.name": rx }, { "client.gstin": rx }];
    }

    const invoices = await ServiceInvoice.find(query).sort({ invoiceDate: -1, createdAt: -1 }).limit(1000).lean();
    return NextResponse.json({ success: true, data: invoices });
  } catch (error: any) {
    return errorResponse(error, "Failed to load invoices");
  }
}

/** Direct invoice from a Non-GST company (no PI, no tax). Tax invoices come from /pis/[id]/tax-invoice. */
export async function POST(req: Request) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;
    const body = await req.json();

    const invoice: any = await withOptionalTransaction(async (session) => {
      const parties = await loadBillingParties(body.clientId, body.companyId, session);
      if (parties.gstType !== "NON_GST") {
        throw new BillingError(`${parties.company.name} is a GST company: raise a PI first, then generate the tax invoice once it is paid.`);
      }
      const invoiceDate = requireDate(body.invoiceDate, "Invoice date");
      const period = requirePeriod(body.billingPeriodFrom, body.billingPeriodTo);
      const description = String(body.description || parties.client.serviceDescription || "").trim();
      if (!description) throw new BillingError("Enter the service description");
      const businessType = body.businessType || "DIGITAL_MARKETING";
      if (!(BUSINESS_TYPES as readonly string[]).includes(businessType)) throw new BillingError("Unknown business type");

      const sacCode = String(body.sacCode || "").trim();
      if (sacCode && !/^d{4,8}$/.test(sacCode)) throw new BillingError("SAC code should be 4–8 digits");
      const tax = computeTax(rupeesToPaiseStrict(body.amount, "Amount"), "NONE", { cgstRate: 0, sgstRate: 0, igstRate: 0 });
      const { number, financialYear } = await nextDocNumber(parties.company, "NON_GST_INVOICE", invoiceDate, session);

      const [created] = await ServiceInvoice.create(
        [
          {
            invoiceType: "NON_GST_INVOICE",
            invoiceNumber: number,
            financialYear,
            invoiceDate,
            companyId: parties.company._id,
            company: parties.companySnapshot,
            clientId: parties.client._id,
            client: parties.clientSnapshot,
            saleType: "NON_GST",
            businessType,
            description,
            sacCode,
            ...period,
            notes: String(body.notes || "").trim(),
            ...tax,
            amountReceivedPaise: 0,
            paymentStatus: "UNPAID",
            isLocked: true,
            lockedAt: new Date(),
          },
        ],
        session ? { session } : undefined
      );
      return created;
    });

    await logAuditEntry({
      collectionName: "serviceinvoices",
      docId: invoice._id,
      action: "CREATE",
      changedFields: [
        { field: "invoiceNumber", oldValue: null, newValue: invoice.invoiceNumber },
        { field: "client", oldValue: null, newValue: invoice.client?.name },
        { field: "totalPaise", oldValue: null, newValue: invoice.totalPaise },
      ],
      userId: auth.user._id,
    });

    return NextResponse.json({ success: true, message: `Invoice ${invoice.invoiceNumber} created`, data: invoice }, { status: 201 });
  } catch (error: any) {
    return errorResponse(error, "Failed to create invoice");
  }
}
