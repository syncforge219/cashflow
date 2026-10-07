import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ServicePI from "@/models/ServicePI";
import ServiceInvoice from "@/models/ServiceInvoice";
import Company from "@/models/Company";
import { requireBillingUser, badRequest, isObjectId, errorResponse } from "@/lib/billingServer";
import { BillingError, nextDocNumber } from "@/lib/billingDocs";
import { saleTypeFor } from "@/lib/billingTax";
import { withOptionalTransaction } from "@/lib/transactionHelper";
import { logAuditEntry } from "@/lib/auditLogger";
import { parseDateOnly, todayKey, dateKeyToDate } from "@/lib/dates";

/**
 * Generates the GST tax invoice for a fully paid PI. Amounts and tax come from the PI; the invoice
 * is numbered from the company's tax-invoice series, linked to the PI both ways, and locked.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await params;
    if (!isObjectId(id)) return badRequest("Invalid PI id");
    const body = await req.json().catch(() => ({}));

    const invoice: any = await withOptionalTransaction(async (session) => {
      const opts = session ? { session } : undefined;
      const pi: any = await ServicePI.findById(id).session(session || null);
      if (!pi) throw new BillingError("PI not found", 404);
      if (pi.taxInvoiceId) throw new BillingError("A tax invoice already exists for this PI");
      if (pi.status !== "PAID") throw new BillingError("The PI must be fully paid before its tax invoice is generated");
      if (pi.company?.gstType !== "GST") throw new BillingError("Tax invoices are only for GST companies");

      const company: any = await Company.findById(pi.companyId).session(session || null).lean();
      if (!company) throw new BillingError("The billing company no longer exists");

      const invoiceDate = body.invoiceDate ? parseDateOnly(body.invoiceDate) : dateKeyToDate(todayKey());
      if (!invoiceDate) throw new BillingError("Invoice date is not valid");
      if (invoiceDate < pi.piDate) throw new BillingError("Invoice date cannot be before the PI date");

      const { number, financialYear } = await nextDocNumber(company, "TAX_INVOICE", invoiceDate, session);
      const [created] = await ServiceInvoice.create(
        [
          {
            invoiceType: "TAX_INVOICE",
            invoiceNumber: number,
            financialYear,
            invoiceDate,
            companyId: pi.companyId,
            company: pi.company,
            clientId: pi.clientId,
            client: pi.client,
            piId: pi._id,
            piNumber: pi.piNumber,
            saleType: saleTypeFor("GST", pi.client?.gstin),
            businessType: pi.businessType,
            description: pi.description,
            sacCode: pi.sacCode || "",
            billingPeriodFrom: pi.billingPeriodFrom,
            billingPeriodTo: pi.billingPeriodTo,
            notes: pi.notes,
            taxMode: pi.taxMode,
            basePaise: pi.basePaise,
            cgstRate: pi.cgstRate,
            sgstRate: pi.sgstRate,
            igstRate: pi.igstRate,
            cgstPaise: pi.cgstPaise,
            sgstPaise: pi.sgstPaise,
            igstPaise: pi.igstPaise,
            taxPaise: pi.taxPaise,
            totalPaise: pi.totalPaise,
            amountReceivedPaise: pi.amountReceivedPaise,
            paymentStatus: "PAID",
            isLocked: true,
            lockedAt: new Date(),
          },
        ],
        opts
      );
      pi.taxInvoiceId = created._id;
      await pi.save(opts);
      return created;
    });

    await logAuditEntry({
      collectionName: "serviceinvoices",
      docId: invoice._id,
      action: "CREATE",
      changedFields: [
        { field: "invoiceNumber", oldValue: null, newValue: invoice.invoiceNumber },
        { field: "piNumber", oldValue: null, newValue: invoice.piNumber },
        { field: "totalPaise", oldValue: null, newValue: invoice.totalPaise },
      ],
      userId: auth.user._id,
    });

    return NextResponse.json({ success: true, message: `Tax invoice ${invoice.invoiceNumber} generated`, data: invoice }, { status: 201 });
  } catch (error: any) {
    return errorResponse(error, "Failed to generate tax invoice");
  }
}
