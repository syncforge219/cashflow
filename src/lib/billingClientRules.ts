import Company from "@/models/Company";
import { isObjectId } from "@/lib/billingServer";
import { BILLING_CYCLES, clampBillingDay, isValidGstin, normalizeGstin, stateByCode, stateFromGstin } from "@/lib/billing";
import { parseDateOnly } from "@/lib/dates";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates a billing-client body against the billing rules:
 *  - an active billing client must be mapped to at least one of our companies
 *  - the default billing company must be one of the mapped companies
 *  - auto-PI needs a work start date and a billing amount
 * `existing` is the stored client on update (null on create).
 */
export async function parseBillingClientBody(body: any, existing: any | null): Promise<{ data?: any; error?: string }> {
  const data: any = {};
  const merged = (key: string) => (body[key] !== undefined ? body[key] : existing?.[key]);

  // Identity / contact (same fields the quotation screen uses)
  if (!existing || body.name !== undefined) {
    const name = String(body.name ?? "").trim();
    if (!name) return { error: "Client name is required" };
    data.name = name;
  }
  for (const key of ["contactPerson", "address", "city", "pincode", "serviceDescription", "billingNotes"] as const) {
    if (body[key] !== undefined) data[key] = String(body[key] ?? "").trim();
  }
  if (body.phone !== undefined) {
    const phone = String(body.phone ?? "").trim();
    if (phone && phone.replace(/\D/g, "").length < 10) return { error: "Mobile number should have at least 10 digits" };
    data.phone = phone;
  }
  if (body.email !== undefined) {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) return { error: "Email address is not valid" };
    data.email = email;
  }

  // GSTIN decides registered / unregistered sale later; state decides CGST+SGST vs IGST
  if (body.gstin !== undefined) {
    const gstin = normalizeGstin(body.gstin);
    if (gstin && !isValidGstin(gstin)) return { error: "GSTIN format is not valid (it should be 15 characters)" };
    data.gstin = gstin;
  }
  const gstinState = stateFromGstin(merged("gstin"));
  if (gstinState) {
    data.stateCode = gstinState.code;
    data.state = gstinState.name;
  } else if (body.stateCode !== undefined) {
    const st = stateByCode(body.stateCode);
    if (body.stateCode && !st) return { error: "Unknown state" };
    data.stateCode = st?.code || "";
    data.state = st?.name || "";
  }

  if (body.services !== undefined) {
    if (!Array.isArray(body.services)) return { error: "services must be a list" };
    data.services = Array.from(new Set(body.services.map((s: any) => String(s).trim()).filter(Boolean)));
  }
  if (body.clientStatus !== undefined) {
    if (body.clientStatus !== "ACTIVE" && body.clientStatus !== "INACTIVE") return { error: "Status must be Active or Inactive" };
    data.clientStatus = body.clientStatus;
  }

  // Client ↔ company mapping
  if (body.billingCompanyIds !== undefined || body.defaultBillingCompanyId !== undefined) {
    const ids: string[] = Array.from(
      new Set([...(merged("billingCompanyIds") || []), merged("defaultBillingCompanyId")].filter(Boolean).map(String))
    );
    if (ids.some((id) => !isObjectId(id))) return { error: "Invalid billing company" };
    const found = await Company.find({ _id: { $in: ids } }).select("_id status name").lean();
    if (found.length !== ids.length) return { error: "One of the billing companies no longer exists" };
    const inactive = found.find((c: any) => c.status === "INACTIVE");
    if (inactive) return { error: `${(inactive as any).name} is inactive and cannot bill clients` };
    data.billingCompanyIds = ids;
    const def = merged("defaultBillingCompanyId");
    data.defaultBillingCompanyId = def ? String(def) : ids.length === 1 ? ids[0] : null;
  }

  // Billing cycle
  if (body.billingCycle !== undefined) {
    if (!(BILLING_CYCLES as readonly string[]).includes(body.billingCycle)) return { error: "Unknown billing cycle" };
    data.billingCycle = body.billingCycle;
  }
  if (body.customCycleMonths !== undefined) {
    data.customCycleMonths = body.customCycleMonths === "" || body.customCycleMonths === null ? undefined : Number(body.customCycleMonths);
  }
  if (merged("billingCycle") === "CUSTOM") {
    const m = Number(merged("customCycleMonths"));
    if (!Number.isInteger(m) || m < 1 || m > 24) return { error: "For a custom cycle, enter how many months it covers (1–24)" };
  }
  if (body.billingDay !== undefined) data.billingDay = clampBillingDay(body.billingDay);
  if (body.workStartDate !== undefined) {
    if (body.workStartDate === "" || body.workStartDate === null) data.workStartDate = null;
    else {
      const d = parseDateOnly(body.workStartDate);
      if (!d) return { error: "Work start date is not valid" };
      data.workStartDate = d;
    }
  }
  if (body.defaultBillingAmount !== undefined) {
    const amt = Number(body.defaultBillingAmount || 0);
    if (!Number.isFinite(amt) || amt < 0) return { error: "Billing amount must be a positive number" };
    data.defaultBillingAmount = Math.round(amt * 100) / 100;
  }
  if (body.autoGeneratePI !== undefined) data.autoGeneratePI = Boolean(body.autoGeneratePI);

  // Rules that depend on the final state of the record
  const finalStatus = merged("clientStatus") || "ACTIVE";
  const finalCompanies = data.billingCompanyIds ?? existing?.billingCompanyIds ?? [];
  if (finalStatus === "ACTIVE" && finalCompanies.length === 0) {
    return { error: "Map the client to at least one billing company (the company the invoice is raised from)." };
  }
  if (data.autoGeneratePI ?? existing?.autoGeneratePI) {
    if (!(data.workStartDate ?? existing?.workStartDate)) return { error: "Auto PI needs a work start date" };
    if (!((data.defaultBillingAmount ?? existing?.defaultBillingAmount) > 0)) return { error: "Auto PI needs a billing amount" };
  }

  data.isBillingClient = true;
  return { data };
}
