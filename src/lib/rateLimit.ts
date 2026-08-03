/**
 * Centralized API Rate Limiting Utility (Sliding Window Algorithm)
 * Prevents brute-force attacks and abuse on public authentication & form endpoints.
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};

/**
 * Clean up expired rate limit entries periodically (every 5 minutes)
 */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    Object.keys(rateLimitStore).forEach((key) => {
      if (rateLimitStore[key].resetTime < now) {
        delete rateLimitStore[key];
      }
    });
  }, 5 * 60 * 1000);
}

export interface RateLimitOptions {
  limit?: number; // Max requests allowed per window (default: 10)
  windowMs?: number; // Time window in milliseconds (default: 60,000ms = 1 minute)
}

/**
 * Checks if a given identifier (IP or User ID) has exceeded request rate limit.
 * 
 * @param identifier - Unique identifier (e.g., client IP address or user ID)
 * @param options - Configurable limit and windowMs
 * @returns { isLimited: boolean, current: number, limit: number, remainingMs: number }
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): { isLimited: boolean; current: number; limit: number; remainingMs: number } {
  const limit = options.limit || 10;
  const windowMs = options.windowMs || 60 * 1000;
  const now = Date.now();

  const key = `ratelimit_${identifier}`;
  const record = rateLimitStore[key];

  if (!record || record.resetTime < now) {
    rateLimitStore[key] = {
      count: 1,
      resetTime: now + windowMs,
    };
    return {
      isLimited: false,
      current: 1,
      limit,
      remainingMs: windowMs,
    };
  }

  record.count += 1;

  if (record.count > limit) {
    return {
      isLimited: true,
      current: record.count,
      limit,
      remainingMs: Math.max(0, record.resetTime - now),
    };
  }

  return {
    isLimited: false,
    current: record.count,
    limit,
    remainingMs: Math.max(0, record.resetTime - now),
  };
}

/**
 * Helper to extract client IP address from Next.js / Node Request headers
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}
