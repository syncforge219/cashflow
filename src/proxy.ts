import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveSessionToken } from "@/lib/auth";

/**
 * Central authentication gate for every API route.
 *
 * Many route handlers never checked the session themselves, which left user
 * management, finance, reports and admin maintenance endpoints open to anyone.
 * Everything under /api now requires a valid session unless listed below.
 */

// Endpoints that must work without a login (auth flow, public enquiry form, webhooks).
const PUBLIC_API_ROUTES: { path: string; methods?: string[] }[] = [
  { path: "/api/auth/login" },
  { path: "/api/auth/logout" },
  { path: "/api/auth/signup" }, // only allowed while no super admin exists (checked in the handler)
  { path: "/api/auth/send-otp" },
  { path: "/api/auth/verify-otp" },
  { path: "/api/enquiries/public" },
  { path: "/api/enquiries/google-form" },
  { path: "/api/enquiries/justdial-webhook" }, // verifies its own API key / signature
  { path: "/api/enquiries/facebook-webhook" }, // verifies Meta's verify token / X-Hub-Signature-256
  // Read-only lookups used by the public enquiry form at /public/enquiry/[brand]
  { path: "/api/lead-sources", methods: ["GET"] },
  { path: "/api/courses", methods: ["GET"] },
];

// Scheduled jobs from vercel.json. Vercel sends "Authorization: Bearer <CRON_SECRET>".
const CRON_API_ROUTES = [
  "/api/reports/send-email",
  "/api/birthday/check-and-send",
  "/api/emi/check-overdue",
  "/api/reports/daily/send-whatsapp",
];

const SESSION_COOKIE_NAMES = ["token", "session_token", "auth_token", "session"];

function isPublicRoute(pathname: string, method: string): boolean {
  return PUBLIC_API_ROUTES.some(
    (route) => pathname === route.path && (!route.methods || route.methods.includes(method))
  );
}

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return null;
}

function isAuthorizedCron(request: NextRequest, pathname: string): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !CRON_API_ROUTES.includes(pathname)) return false;
  return getBearerToken(request) === cronSecret;
}

function getSessionToken(request: NextRequest): string | null {
  for (const name of SESSION_COOKIE_NAMES) {
    const value = request.cookies.get(name)?.value;
    if (value) return value;
  }
  return getBearerToken(request);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // CORS preflights carry no credentials.
  if (method === "OPTIONS") {
    return NextResponse.next();
  }

  // Normalise a trailing slash so "/api/users/" cannot dodge the allowlist checks.
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (isPublicRoute(normalizedPath, method) || isAuthorizedCron(request, normalizedPath)) {
    return NextResponse.next();
  }

  try {
    const { user } = await resolveSessionToken(getSessionToken(request));
    if (user) {
      const role = (user.role || "").toLowerCase().replace(/[\s_-]+/g, "");

      // One-off data maintenance endpoints rewrite records in bulk: admins only.
      if (normalizedPath.startsWith("/api/admin/")) {
        if (role !== "superadmin" && role !== "admin") {
          return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
      }

      // Lead connector settings hold webhook keys / page tokens and can reset config/logs: managers and above.
      if (
        normalizedPath.startsWith("/api/justdial-integration") ||
        normalizedPath.startsWith("/api/facebook-integration")
      ) {
        const allowed = ["superadmin", "admin", "manager", "brandmanager", "centrehead", "centerhead", "branchhead"];
        if (!allowed.includes(role)) {
          return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }
      }
      return NextResponse.next();
    }
  } catch (error) {
    console.error("[proxy] Session validation failed:", error);
    return NextResponse.json(
      { success: false, error: "Authentication service unavailable" },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { success: false, error: "Unauthorized. Please login again." },
    { status: 401 }
  );
}

export const config = {
  matcher: "/api/:path*",
};
