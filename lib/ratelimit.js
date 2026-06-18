// lib/ratelimit.js
// Shared per-IP rate limiter for the API routes. A request must pass BOTH
// windows to go through: a burst limit (10 per minute) and a volume limit
// (50 per hour). Backed by Upstash Redis so the counts are shared across
// Vercel's serverless instances and survive function restarts.
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

// If Upstash is not configured (for example, running locally before the
// credentials are set), we skip rate limiting rather than crash. The app still
// works; it just is not gated until the credentials are present.
let burst = null;
let volume = null;
if (url && token) {
  const redis = new Redis({ url, token });
  burst = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "loanlens:burst",
  });
  volume = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, "1 h"),
    prefix: "loanlens:volume",
  });
} else {
  console.warn(
    "Rate limiting is OFF: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable it."
  );
}

function clientIp(req) {
  // Vercel passes the real client IP in x-forwarded-for, which can be a
  // comma-separated list (client, then proxies). The first entry is the client.
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0].trim();
  return ip || "anonymous";
}

// Returns a ready-to-send 429 response if the caller is over either limit,
// otherwise returns null to mean "allow this request."
export async function rateLimit(req) {
  if (!burst || !volume) return null; // not configured: allow through
  const ip = clientIp(req);
  try {
    const [b, v] = await Promise.all([burst.limit(ip), volume.limit(ip)]);
    if (!b.success || !v.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute and try again." },
        { status: 429 }
      );
    }
    return null;
  } catch (e) {
    // If Redis is unreachable, fail open so a real user is never blocked by an
    // infrastructure problem. We log it so it is visible in the Vercel logs.
    console.error("Rate limit check failed; allowing request.", e);
    return null;
  }
}
