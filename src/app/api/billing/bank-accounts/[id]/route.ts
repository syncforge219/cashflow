import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import BankAccount from "@/models/BankAccount";
import ClientReceipt from "@/models/ClientReceipt";
import { requireBillingUser, badRequest, isObjectId, errorResponse } from "@/lib/billingServer";
import { logAuditEntry } from "@/lib/auditLogger";
import { parseBankAccountBody, clearOtherDefaults } from "@/lib/bankAccountRules";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = await params;
    if (!isObjectId(id)) return badRequest("Invalid bank account id");

    const existing: any = await BankAccount.findById(id).lean();
    if (!existing) return NextResponse.json({ success: false, error: "Bank account not found" }, { status: 404 });

    const { data, error } = await parseBankAccountBody(await req.json(), false);
    if (error) return badRequest(error);
    // An inactive account cannot stay the default
    if (data.status === "INACTIVE") data.isDefault = false;

    const updated: any = await BankAccount.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after", runValidators: true }).lean();
    if (updated.isDefault) await clearOtherDefaults(updated.companyId, updated._id);

    const changedFields = Object.keys(data)
      .filter((k) => k !== "accountNumber")
      .map((k) => ({ field: k, oldValue: existing[k] ?? null, newValue: updated[k] ?? null }))
      .filter((c) => JSON.stringify(c.oldValue) !== JSON.stringify(c.newValue));
    if (data.accountNumber) {
      changedFields.push({ field: "accountLast4", oldValue: existing.accountLast4 || null, newValue: updated.accountLast4 || null });
    }
    if (changedFields.length > 0) {
      await logAuditEntry({ collectionName: "bankaccounts", docId: updated._id, action: "UPDATE", changedFields, userId: auth.user._id });
    }

    return NextResponse.json({ success: true, message: "Bank account updated", data: updated });
  } catch (error: any) {
    return errorResponse(error, "Failed to update bank account");
  }
}

/** Soft delete, only for accounts that never received a payment (others can be deactivated instead). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const auth = await requireBillingUser();
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = await params;
    if (!isObjectId(id)) return badRequest("Invalid bank account id");

    const account: any = await BankAccount.findById(id);
    if (!account) return NextResponse.json({ success: false, error: "Bank account not found" }, { status: 404 });

    // Bank-wise reports need the account behind every receipt
    if (await ClientReceipt.exists({ bankAccountId: account._id })) {
      return badRequest(`${account.label} has received payments, so it can't be removed. Edit it and untick "Active" instead.`);
    }

    account.isDeleted = true;
    account.deletedAt = new Date();
    account.deletedBy = auth.user._id;
    account.isDefault = false;
    account.status = "INACTIVE";
    await account.save();

    await logAuditEntry({
      collectionName: "bankaccounts",
      docId: account._id,
      action: "SOFT_DELETE",
      changedFields: [{ field: "isDeleted", oldValue: false, newValue: true }],
      userId: auth.user._id,
    });

    return NextResponse.json({ success: true, message: "Bank account removed" });
  } catch (error: any) {
    return errorResponse(error, "Failed to remove bank account");
  }
}
