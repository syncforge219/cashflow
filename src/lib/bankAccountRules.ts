import BankAccount from "@/models/BankAccount";
import Company from "@/models/Company";
import { isObjectId } from "@/lib/billingServer";
import { BANK_ACCOUNT_TYPES } from "@/lib/billing";

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Validates and normalises a bank account body. Shared by create and update. */
export async function parseBankAccountBody(body: any, isCreate: boolean): Promise<{ data?: any; error?: string }> {
  const data: any = {};

  if (isCreate || body.companyId !== undefined) {
    if (!isObjectId(body.companyId)) return { error: "Choose the company this account belongs to" };
    const company = await Company.exists({ _id: body.companyId });
    if (!company) return { error: "Company not found" };
    data.companyId = body.companyId;
  }
  for (const key of ["label", "bankName"] as const) {
    if (isCreate || body[key] !== undefined) {
      const v = String(body[key] ?? "").trim();
      if (!v) return { error: key === "label" ? "Account label is required" : "Bank name is required" };
      data[key] = v;
    }
  }
  for (const key of ["accountHolderName", "branch", "upiId"] as const) {
    if (body[key] !== undefined) data[key] = String(body[key] ?? "").trim();
  }
  if (body.ifsc !== undefined) {
    const ifsc = String(body.ifsc ?? "").trim().toUpperCase();
    if (ifsc && !IFSC_RE.test(ifsc)) return { error: "IFSC must be 11 characters: 4 letters, a zero, then 6 letters or digits" };
    data.ifsc = ifsc;
  }
  // Account number: only sent when entered/changed; the stored value is never returned to the browser
  if (body.accountNumber !== undefined && String(body.accountNumber).trim() !== "") {
    const digits = String(body.accountNumber).replace(/\s+/g, "");
    if (!/^[0-9A-Z]{6,20}$/i.test(digits)) return { error: "Account number should be 6–20 digits" };
    data.accountNumber = digits;
  } else if (isCreate && body.accountType !== "OTHER") {
    return { error: "Account number is required" };
  }
  if (body.accountType !== undefined) {
    if (!(BANK_ACCOUNT_TYPES as readonly string[]).includes(body.accountType)) return { error: "Unknown account type" };
    data.accountType = body.accountType;
  }
  if (body.gstApplicable !== undefined) data.gstApplicable = Boolean(body.gstApplicable);
  if (body.isDefault !== undefined) data.isDefault = Boolean(body.isDefault);
  if (body.status !== undefined) {
    if (body.status !== "ACTIVE" && body.status !== "INACTIVE") return { error: "Status must be Active or Inactive" };
    data.status = body.status;
  }
  return { data };
}

/** Keeps a single default account per company. */
export async function clearOtherDefaults(companyId: any, keepId: any) {
  await BankAccount.updateMany({ companyId, _id: { $ne: keepId }, isDefault: true }, { $set: { isDefault: false } });
}
