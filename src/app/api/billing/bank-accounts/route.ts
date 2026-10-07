import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import BankAccount from "@/models/BankAccount";
import { requireBillingUser, badRequest, isObjectId, errorResponse } from "@/lib/billingServer";
import { logAuditEntry } from "@/lib/auditLogger";
import { parseBankAccountBody, clearOtherDefaults } from "@/lib/bankAccountRules";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const query: any = {};
    const companyId = searchParams.get("companyId");
    if (companyId) {
      if (!isObjectId(companyId)) return badRequest("Invalid company id");
      query.companyId = companyId;
    }
    if (searchParams.get("status") === "ACTIVE") query.status = "ACTIVE";

    const accounts = await BankAccount.find(query)
      .populate("companyId", "name gstType gst")
      .sort({ companyId: 1, isDefault: -1, label: 1 })
      .lean();

    const data = accounts.map((a: any) => ({
      ...a,
      companyName: a.companyId?.name || "",
      companyId: a.companyId?._id || a.companyId,
    }));
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return errorResponse(error, "Failed to load bank accounts");
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;

    const { data, error } = await parseBankAccountBody(await req.json(), true);
    if (error) return badRequest(error);

    // First account of a company becomes its default automatically
    const existingCount = await BankAccount.countDocuments({ companyId: data.companyId });
    if (existingCount === 0) data.isDefault = true;

    const account: any = await BankAccount.create(data);
    if (account.isDefault) await clearOtherDefaults(account.companyId, account._id);

    await logAuditEntry({
      collectionName: "bankaccounts",
      docId: account._id,
      action: "CREATE",
      changedFields: [
        { field: "label", oldValue: null, newValue: account.label },
        { field: "companyId", oldValue: null, newValue: account.companyId },
        { field: "accountLast4", oldValue: null, newValue: account.accountLast4 },
      ],
      userId: auth.user._id,
    });

    const { accountNumber: _omit, ...safe } = account.toObject();
    void _omit;
    return NextResponse.json({ success: true, message: "Bank account added", data: safe }, { status: 201 });
  } catch (error: any) {
    return errorResponse(error, "Failed to add bank account");
  }
}
