import { escapeRegex } from "@/lib/helper";
import { normalizeRole } from "@/lib/roles";

/**
 * Server-side "own records only" scoping for sales-facing roles.
 *
 * Counsellors / sales executives must only see the leads, admissions and tasks assigned to them.
 * This used to be enforced only in the browser (followups page), so any of them could read
 * everyone's data straight from the API. Every list/detail endpoint now applies these filters.
 */

export interface OwnerScope {
  id: any;
  /** Case-insensitive, exact-match regex of the user's name (never a substring match). */
  nameRegex: RegExp;
  name: string;
}

/** Roles that only ever see their own records. Managers, admins, CFO etc. are not restricted. */
export function isOwnRecordsRole(role: unknown): boolean {
  const r = normalizeRole(role);
  if (!r) return false;
  // Management roles that merely contain a sales-ish word stay unrestricted.
  if (/(admin|director|manager|head|cfo|finance)/.test(r)) return false;
  return /(counsellor|counselor|salesexecutive|sales|crm)/.test(r);
}

/** Returns null when the user may see everything, otherwise the identity to filter on. */
export function getOwnerScope(user: any): OwnerScope | null {
  if (!user) return null;
  const role = user.role || user.crmRole || user.designation;
  if (!isOwnRecordsRole(role)) return null;
  const name = String(user.name || "").trim();
  return {
    id: user._id,
    name,
    nameRegex: new RegExp(`^${escapeRegex(name || "__no_name__")}$`, "i"),
  };
}

/** Mongo condition for Enquiry documents. Unassigned leads stay visible so they can be picked up. */
export function enquiryOwnerCondition(scope: OwnerScope) {
  return {
    $or: [
      { assignedCrmAdvisorId: scope.id },
      { assignedCrmAdvisor: scope.nameRegex },
      { assignedCrmAdvisor: { $in: [null, "", "Unassigned", "unassigned"] } },
      { assignedCrmAdvisor: { $exists: false } },
    ],
  };
}

/** True when an already-loaded enquiry belongs to the scoped user (or is unassigned). */
export function enquiryVisibleTo(scope: OwnerScope, enquiry: any): boolean {
  const adv = String(enquiry?.assignedCrmAdvisor || "").trim();
  if (!adv || adv.toLowerCase() === "unassigned") return true;
  if (enquiry?.assignedCrmAdvisorId && String(enquiry.assignedCrmAdvisorId) === String(scope.id)) return true;
  return scope.nameRegex.test(adv);
}

/** Mongo condition for Admission documents. */
export function admissionOwnerCondition(scope: OwnerScope) {
  return { $or: [{ counsellorId: scope.id }, { counsellor: scope.nameRegex }] };
}

/** True when an already-loaded admission belongs to the scoped user. */
export function admissionVisibleTo(scope: OwnerScope, admission: any): boolean {
  if (admission?.counsellorId && String(admission.counsellorId) === String(scope.id)) return true;
  return scope.nameRegex.test(String(admission?.counsellor || "").trim());
}

/**
 * Route guard for single-enquiry endpoints. Returns a 403/404 response when the signed-in
 * sales user is not allowed to touch this enquiry, otherwise null.
 */
export async function guardEnquiryAccess(enquiryId: string): Promise<Response | null> {
  const { getUserFromCookies } = await import("@/lib/helper");
  const user = await getUserFromCookies();
  const scope = getOwnerScope(user);
  if (!scope) return null;

  const { default: Enquiry } = await import("@/models/Enquiry");
  const enquiry: any = await Enquiry.findById(enquiryId)
    .select("assignedCrmAdvisor assignedCrmAdvisorId")
    .lean();
  if (!enquiry) return null; // let the route return its own 404
  if (enquiryVisibleTo(scope, enquiry)) return null;

  return Response.json(
    { success: false, message: "You can only access leads assigned to you." },
    { status: 403 }
  );
}
