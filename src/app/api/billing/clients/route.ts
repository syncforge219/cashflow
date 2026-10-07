import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import QuotationCustomer from "@/models/QuotationCustomer";
import { requireBillingUser, badRequest, errorResponse } from "@/lib/billingServer";
import { parseBillingClientBody } from "@/lib/billingClientRules";
import { logAuditEntry } from "@/lib/auditLogger";
import { escapeRegex } from "@/lib/helper";

/**
 * Billing clients. They live in the same collection as quotation customers, so one client list
 * serves quotations and billing. `?scope=all` also returns quotation-only customers, so staff can
 * turn an existing customer into a billing client instead of re-typing it.
 */
export async function GET(req: Request) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const query: any = {};
    if (searchParams.get("scope") !== "all") query.isBillingClient = true;
    const status = searchParams.get("status");
    if (status === "ACTIVE" || status === "INACTIVE") query.clientStatus = status;
    const q = (searchParams.get("q") || "").trim();
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      query.$or = [{ name: rx }, { contactPerson: rx }, { gstin: rx }, { email: rx }, { phone: rx }];
    }

    const clients = await QuotationCustomer.find(query)
      .populate("billingCompanyIds", "name gstType gst")
      .populate("defaultBillingCompanyId", "name")
      .sort({ isBillingClient: -1, name: 1 })
      .lean();

    return NextResponse.json({ success: true, data: clients });
  } catch (error: any) {
    return errorResponse(error, "Failed to load clients");
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json();
    const { data, error } = await parseBillingClientBody(body, null);
    if (error) return badRequest(error);

    // Same client typed twice is the most common master-data mistake
    const dupe: any = await QuotationCustomer.findOne({
      $or: [
        { name: new RegExp(`^${escapeRegex(data.name)}$`, "i") },
        ...(data.gstin ? [{ gstin: data.gstin }] : []),
      ],
    })
      .select("name isBillingClient")
      .lean();
    if (dupe) {
      return badRequest(
        dupe.isBillingClient
          ? `'${dupe.name}' already exists as a billing client.`
          : `'${dupe.name}' already exists as a quotation customer. Use "Add existing customer" to enable billing for it.`
      );
    }

    const client: any = await QuotationCustomer.create({ companyId: "DEFAULT_COMPANY", ...data });
    await logAuditEntry({
      collectionName: "quotationcustomers",
      docId: client._id,
      action: "CREATE",
      changedFields: [
        { field: "name", oldValue: null, newValue: client.name },
        { field: "gstin", oldValue: null, newValue: client.gstin || null },
        { field: "billingCompanyIds", oldValue: null, newValue: client.billingCompanyIds },
      ],
      userId: auth.user._id,
    });

    return NextResponse.json({ success: true, message: "Client added", data: client }, { status: 201 });
  } catch (error: any) {
    return errorResponse(error, "Failed to add client");
  }
}
