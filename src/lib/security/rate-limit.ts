import type { NextRequest } from "next/server";

interface BucketEntry {
  timestamps: number[];
}

const buckets = new Map<string, BucketEntry>();
const MAX_BUCKETS = 2000;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export function getClientIdentifier(req: Request | NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "local-client";
}

/**
 * In-memory sliding-window rate limiter protecting upstream APIs (Gemini, Channel3, PayPal).
 * Suitable for single-instance Node deployments; replace with Redis/Upstash for multi-instance scale.
 */
export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs?: number;
  nowMs?: number;
}): RateLimitResult {
  const windowMs = params.windowMs ?? 60_000;
  const now = params.nowMs ?? Date.now();
  const cutoff = now - windowMs;

  let entry = buckets.get(params.key);
  if (!entry) {
    if (buckets.size >= MAX_BUCKETS) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey) buckets.delete(oldestKey);
    }
    entry = { timestamps: [] };
    buckets.set(params.key, entry);
  }

  entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

  if (entry.timestamps.length >= params.limit) {
    const oldestInWindow = entry.timestamps[0] ?? now;
    const retryAfterMs = Math.max(1000, oldestInWindow + windowMs - now);
    return {
      allowed: false,
      limit: params.limit,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    limit: params.limit,
    remaining: Math.max(0, params.limit - entry.timestamps.length),
    retryAfterSeconds: 0,
  };
}

export function rateLimitExceededResponse(result: RateLimitResult): Response {
  return Response.json(
    {
      error: "Too many requests. Please retry shortly.",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    }
  );
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}

