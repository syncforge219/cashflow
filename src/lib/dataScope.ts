import mongoose from "mongoose";
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
  /** Flexible, whitespace-tolerant regex of the user's name. */
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
  const rawName = String(user.name || "").trim();
  const normalizedName = rawName.replace(/\s+/g, " ");
  const words = normalizedName.split(" ").filter(Boolean).map(escapeRegex);
  const pattern = words.length > 0 ? words.join("\\s+") : escapeRegex(rawName || "__no_name__");

  return {
    id: user._id || user.id,
    name: normalizedName,
    nameRegex: new RegExp(pattern, "i"),
  };
}

/** Helper to generate ObjectId and string ID clauses */
function buildIdClauses(field: string, id: any): any[] {
  if (!id) return [];
  const clauses: any[] = [{ [field]: id }];
  const idStr = String(id);
  if (mongoose.Types.ObjectId.isValid(idStr)) {
    try {
      clauses.push({ [field]: new mongoose.Types.ObjectId(idStr) });
    } catch {
      // ignore
    }
  }
  return clauses;
}

/** Mongo condition for Enquiry documents. Unassigned leads and leads with tasks for this user stay visible. */
export function enquiryOwnerCondition(scope: OwnerScope) {
  const idClauses = buildIdClauses("assignedCrmAdvisorId", scope.id);

  return {
    $or: [
      ...idClauses,
      { assignedCrmAdvisor: scope.nameRegex },
      { "followUps.assignedTo": scope.nameRegex },
      { "followUps.plannedBy": scope.nameRegex },
      { assignedCrmAdvisor: { $in: [null, "", "Unassigned", "unassigned", "N/A", "n/a"] } },
      { assignedCrmAdvisor: { $exists: false } },
    ],
  };
}

/** True when an already-loaded enquiry belongs to the scoped user (or has a follow-up for them, or is unassigned). */
export function enquiryVisibleTo(scope: OwnerScope, enquiry: any): boolean {
  const adv = String(enquiry?.assignedCrmAdvisor || "").trim();
  if (!adv || ["unassigned", "n/a", "none"].includes(adv.toLowerCase())) return true;

  if (enquiry?.assignedCrmAdvisorId && String(enquiry.assignedCrmAdvisorId) === String(scope.id)) {
    return true;
  }
  if (scope.nameRegex.test(adv)) return true;

  // Check if any subdocument in followUps is assigned to or planned by this user
  if (Array.isArray(enquiry?.followUps)) {
    const hasMyFollowup = enquiry.followUps.some((f: any) => {
      const assigned = String(f?.assignedTo || "").trim();
      const planned = String(f?.plannedBy || "").trim();
      return scope.nameRegex.test(assigned) || scope.nameRegex.test(planned);
    });
    if (hasMyFollowup) return true;
  }

  // Name partial match fallback (e.g. "Kashish" matching "Kashish Naqvi")
  const lowerName = scope.name.toLowerCase();
  const lowerAdv = adv.toLowerCase();
  if (lowerName && lowerAdv && (lowerName.includes(lowerAdv) || lowerAdv.includes(lowerName))) {
    return true;
  }

  return false;
}

/** Mongo condition for Admission documents. */
export function admissionOwnerCondition(scope: OwnerScope) {
  const idClauses = buildIdClauses("counsellorId", scope.id);
  return {
    $or: [
      ...idClauses,
      { counsellor: scope.nameRegex },
      { counsellor: { $in: [null, "", "Unassigned", "unassigned"] } },
      { counsellor: { $exists: false } },
    ],
  };
}

/** True when an already-loaded admission belongs to the scoped user. */
export function admissionVisibleTo(scope: OwnerScope, admission: any): boolean {
  if (admission?.counsellorId && String(admission.counsellorId) === String(scope.id)) return true;
  const c = String(admission?.counsellor || "").trim();
  if (!c || ["unassigned", "n/a"].includes(c.toLowerCase())) return true;
  if (scope.nameRegex.test(c)) return true;
  const lowerName = scope.name.toLowerCase();
  const lowerC = c.toLowerCase();
  return Boolean(lowerName && lowerC && (lowerName.includes(lowerC) || lowerC.includes(lowerName)));
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
    .select("assignedCrmAdvisor assignedCrmAdvisorId followUps")
    .lean();
  if (!enquiry) return null; // let the route return its own 404
  if (enquiryVisibleTo(scope, enquiry)) return null;

  return Response.json(
    { success: false, message: "You can only access leads assigned to you." },
    { status: 403 }
  );
}
