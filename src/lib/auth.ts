import { cookies, headers } from "next/headers";
import crypto from "node:crypto";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Session from "@/models/Session";
import { verifyJWT } from "@/lib/jwt";
import { setRequestContextUser } from "@/lib/requestContext";

export const SESSION_COOKIE_NAME = "token";
export const SESSION_DURATION_SECONDS = 3600 * 24 * 365 * 10; // 10 years persistent login duration

export interface AuthenticatedUser {
  _id: any;
  id: string;
  name: string;
  email: string;
  role: string;
  brandScope?: string;
  phone?: string;
  photoUrl?: string;
  brandLogo?: string;
  customAppName?: string;
  [key: string]: any;
}

/**
 * Reads the session token from HTTP-only cookie or Authorization header.
 */
export async function getRawSessionToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      token = cookieStore.get("session_token")?.value;
    }
    if (!token) {
      token = cookieStore.get("token")?.value;
    }
    if (!token) {
      token = cookieStore.get("auth_token")?.value;
    }
    if (!token) {
      token = cookieStore.get("session")?.value;
    }

    if (!token) {
      const headersList = await headers();
      const authHeader = headersList.get("authorization") || headersList.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    return token || null;
  } catch (error) {
    return null;
  }
}

/**
 * Computes SHA-256 hash of a session token for secure storage at rest.
 */
export function hashSessionToken(token: string): string {
  if (!token) return "";
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a new database session for the given user ID.
 * Stores only the SHA-256 hash in the database while returning the raw token to the client.
 * Invalidates old sessions for the user to prevent session fixation.
 */
export async function createSession(userId: string, expiresInSeconds: number = SESSION_DURATION_SECONDS) {
  await dbConnect();

  // Clean up any pre-existing sessions for this user (session fixation prevention)
  await Session.deleteMany({ userId });

  // Generate high-entropy random session identifier (sent to client)
  const rawSessionToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawSessionToken);
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  const newSession = await Session.create({
    userId,
    sessionToken: tokenHash,
    token: tokenHash,
    expiresAt,
  });

  return {
    sessionToken: rawSessionToken,
    token: rawSessionToken,
    expiresAt,
    session: newSession,
  };
}

/**
 * Destroys/invalidates a session by deleting its SHA-256 hash from MongoDB.
 */
export async function destroySession(sessionToken?: string | null) {
  if (!sessionToken) return;
  try {
    await dbConnect();
    const tokenHash = hashSessionToken(sessionToken);
    await Session.deleteOne({
      $or: [{ sessionToken: tokenHash }, { token: tokenHash }, { sessionToken }],
    });
  } catch (error) {
    console.error("Error destroying session:", error);
  }
}

/**
 * Validates session token and returns the authenticated User document and Session.
 * Compares SHA-256 hash of the incoming token against the stored hash.
 */
export async function getAuthenticatedUserAndSession(): Promise<{
  user: AuthenticatedUser | null;
  session: any | null;
}> {
  try {
    const token = await getRawSessionToken();
    if (!token) {
      return { user: null, session: null };
    }

    await dbConnect();

    // 1. Find database session by SHA-256 hash (with fallback to legacy plain token)
    const tokenHash = hashSessionToken(token);
    let dbSession = await Session.findOne({
      $or: [{ sessionToken: tokenHash }, { token: tokenHash }, { sessionToken: token }],
    });

    if (dbSession) {
      // Check expiration
      if (new Date(dbSession.expiresAt).getTime() < Date.now()) {
        await Session.deleteOne({ _id: dbSession._id });
        return { user: null, session: null };
      }

      const dbUser = await User.findById(dbSession.userId).select("-password").lean();
      if (!dbUser) {
        await Session.deleteOne({ _id: dbSession._id });
        return { user: null, session: null };
      }

      const role = ((dbUser as any).role || "").toLowerCase().trim();
      if (role.includes("marketing")) {
        return { user: null, session: null };
      }

      const normalizedUser: AuthenticatedUser = {
        ...(dbUser as any),
        id: dbUser._id.toString(),
      };
      setRequestContextUser(normalizedUser);

      return { user: normalizedUser, session: dbSession };
    }

    // 2. Legacy fallback: Check if token is valid signed JWT
    const decoded = await verifyJWT(token);
    if (decoded && decoded.id) {
      const dbUser = await User.findById(decoded.id).select("-password").lean();
      if (dbUser) {
        const role = ((dbUser as any).role || "").toLowerCase().trim();
        if (!role.includes("marketing")) {
          // Upgrade: Create DB session for active legacy JWT user
          const { sessionToken, expiresAt, session: newSession } = await createSession(dbUser._id.toString());
          const normalizedUser: AuthenticatedUser = {
            ...(dbUser as any),
            id: dbUser._id.toString(),
          };
          setRequestContextUser(normalizedUser);
          return { user: normalizedUser, session: newSession };
        }
      }
    }

    return { user: null, session: null };
  } catch (error: any) {
    if (error?.digest === "DYNAMIC_SERVER_USAGE" || error?.message?.includes("Dynamic server usage")) {
      throw error;
    }
    console.error("Error in getAuthenticatedUserAndSession:", error);
    return { user: null, session: null };
  }
}

/**
 * Primary server-side utility to get the currently authenticated User.
 * Returns null if unauthenticated, expired, or unauthorized.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const { user } = await getAuthenticatedUserAndSession();
  return user;
}

export const getUserFromCookies = getAuthenticatedUser;
