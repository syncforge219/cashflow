import { cookies, headers } from "next/headers";
import crypto from "node:crypto";
import dbConnect from "@/lib/db";
import User from "@/models/User";
import Session from "@/models/Session";
import { verifyJWT } from "@/lib/jwt";

export const SESSION_COOKIE_NAME = "token";
export const SESSION_DURATION_SECONDS = 3600 * 24; // 24 hours

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
 * Creates a new database session for the given user ID.
 * Invalidates old sessions for the user to prevent session fixation.
 */
export async function createSession(userId: string, expiresInSeconds: number = SESSION_DURATION_SECONDS) {
  await dbConnect();

  // Clean up any pre-existing sessions for this user (session fixation prevention)
  await Session.deleteMany({ userId });

  // Generate high-entropy random session identifier
  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  const newSession = await Session.create({
    userId,
    sessionToken,
    expiresAt,
  });

  return {
    sessionToken,
    expiresAt,
    session: newSession,
  };
}

/**
 * Destroys/invalidates a session by deleting it from MongoDB.
 */
export async function destroySession(sessionToken?: string | null) {
  if (!sessionToken) return;
  try {
    await dbConnect();
    await Session.deleteOne({ sessionToken });
  } catch (error) {
    console.error("Error destroying session:", error);
  }
}

/**
 * Validates session token and returns the authenticated User document and Session.
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

    // 1. Try finding database session by token
    let dbSession = await Session.findOne({ sessionToken: token });

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
