/**
 * Role helpers shared by the proxy, auth and pages.
 *
 * "Marketing Executive" is a narrow role: add leads, set up the lead connectors (Justdial,
 * Facebook) and log/see marketing spend and cost per lead for the leads they brought in.
 * Every other API is refused for this role on the server (see MARKETING_API_ALLOW).
 *
 * Older roles containing "marketing" (e.g. "marketing lead") were decommissioned and stay blocked.
 */

export const MARKETING_ROLE = "marketing executive";
export const MARKETING_HOME = "/marketing-dashboard";

export const normalizeRole = (role: unknown) => String(role || "").toLowerCase().replace(/[\s_-]+/g, "");

export function isMarketingExecutive(role: unknown): boolean {
  return normalizeRole(role) === "marketingexecutive";
}

/** Legacy marketing roles: still not allowed to sign in. */
export function isDecommissionedMarketingRole(role: unknown): boolean {
  return normalizeRole(role).includes("marketing") && !isMarketingExecutive(role);
}

export function isAdminRole(role: unknown): boolean {
  const r = normalizeRole(role);
  return r === "superadmin" || r === "admin" || r === "director";
}

/**
 * The only API routes a Marketing Executive may call. Everything else returns 403, so finance,
 * admissions, students, reports, users etc. stay invisible even if called directly.
 */
export const MARKETING_API_ALLOW: { prefix: string; methods?: string[] }[] = [
  { prefix: "/api/marketing" }, // own leads, spend, cost summary, name lookups
  { prefix: "/api/justdial-integration" }, // Justdial connector set-up, test, pull, logs
  { prefix: "/api/facebook-integration" }, // Facebook Lead Ads connector
  { prefix: "/api/lead-sources", methods: ["GET", "POST"] }, // pick / add a lead source
  { prefix: "/api/courses", methods: ["GET"] },
  { prefix: "/api/auth" }, // logout, session checks
];

export function isMarketingApiAllowed(pathname: string, method: string): boolean {
  return MARKETING_API_ALLOW.some(
    (rule) =>
      (pathname === rule.prefix || pathname.startsWith(rule.prefix + "/")) &&
      (!rule.methods || rule.methods.includes(method.toUpperCase()))
  );
}

/** Pages a Marketing Executive may open; any other page redirects to MARKETING_HOME. */
export function isMarketingPageAllowed(pathname: string): boolean {
  return pathname === MARKETING_HOME || pathname.startsWith(MARKETING_HOME + "/");
}
