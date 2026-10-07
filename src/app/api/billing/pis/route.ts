import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import ServicePI from "@/models/ServicePI";
import { requireBillingUser, badRequest, isObjectId, errorResponse } from "@/lib/billingServer";
import { BillingError, loadBillingParties, nextDocNumber, requireDate, requirePeriod, rupeesToPaiseStrict } from "@/lib/billingDocs";
import { computeTax } from "@/lib/billingTax";
import { BUSINESS_TYPES } from "@/lib/billing";
import { withOptionalTransaction } from "@/lib/transactionHelper";
import { logAuditEntry } from "@/lib/auditLogger";
import { escapeRegex } from "@/lib/helper";
import { istDayRange, toDateKey } from "@/lib/dates";

const OPEN_STATUSES = ["GENERATED", "SENT", "PARTIALLY_PAID"];

/** Lists PIs. ?pending=1 returns only PIs still awaiting payment (used by receipt entry). */
export async function GET(req: Request) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const query: any = {};
    if (searchParams.get("pending") === "1") query.status = { $in: OPEN_STATUSES };
    else if (searchParams.get("status")) query.status = { $in: searchParams.get("status")!.split(",") };
    for (const key of ["clientId", "companyId"] as const) {
      const v = searchParams.get(key);
      if (v) {
        if (!isObjectId(v)) return badRequest(`Invalid ${key}`);
        query[key] = v;
      }
    }
    const from = toDateKey(searchParams.get("from"));
    const to = toDateKey(searchParams.get("to"));
    if (from || to) query.piDate = { $gte: istDayRange(from || "2000-01-01").start, $lte: istDayRange(to || "2100-01-01").end };
    const q = (searchParams.get("q") || "").trim();
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      query.$or = [{ piNumber: rx }, { "client.name": rx }, { "client.gstin": rx }];
    }

    const pis = await ServicePI.find(query).sort({ piDate: -1, createdAt: -1 }).limit(1000).lean();
    return NextResponse.json({ success: true, data: pis });
  } catch (error: any) {
    return errorResponse(error, "Failed to load proforma invoices");
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;
    const body = await req.json();

    const pi: any = await withOptionalTransaction(async (session) => {
      const parties = await loadBillingParties(body.clientId, body.companyId, session);
      if (parties.gstType !== "GST") {
        throw new BillingError(`${parties.company.name} is a Non-GST company. Raise a direct invoice instead of a PI.`);
      }
      const piDate = requireDate(body.piDate, "PI date");
      const period = requirePeriod(body.billingPeriodFrom, body.billingPeriodTo);
      const description = String(body.description || parties.client.serviceDescription || "").trim();
      if (!description) throw new BillingError("Enter the service description");
      const businessType = body.businessType || "DIGITAL_MARKETING";
      if (!(BUSINESS_TYPES as readonly string[]).includes(businessType)) throw new BillingError("Unknown business type");

      const sacCode = String(body.sacCode || "").trim();
      if (sacCode && !/^d{4,8}$/.test(sacCode)) throw new BillingError("SAC code should be 4–8 digits");
      const tax = computeTax(rupeesToPaiseStrict(body.amount, "Amount"), parties.taxMode, parties.rates);
      const { number, financialYear } = await nextDocNumber(parties.company, "PI", piDate, session);

      const [created] = await ServicePI.create(
        [
          {
            piNumber: number,
            financialYear,
            piDate,
            companyId: parties.company._id,
            company: parties.companySnapshot,
            clientId: parties.client._id,
            client: parties.clientSnapshot,
            businessType,
            description,
            sacCode,
            ...period,
            notes: String(body.notes || "").trim(),
            ...tax,
            status: "GENERATED",
          },
        ],
        session ? { session } : undefined
      );
      return created;
    });

    await logAuditEntry({
      collectionName: "servicepis",
      docId: pi._id,
      action: "CREATE",
      changedFields: [
        { field: "piNumber", oldValue: null, newValue: pi.piNumber },
        { field: "client", oldValue: null, newValue: pi.client?.name },
        { field: "totalPaise", oldValue: null, newValue: pi.totalPaise },
      ],
      userId: auth.user._id,
    });

    return NextResponse.json({ success: true, message: `PI ${pi.piNumber} created`, data: pi }, { status: 201 });
  } catch (error: any) {
    return errorResponse(error, "Failed to create PI");
  }
}
