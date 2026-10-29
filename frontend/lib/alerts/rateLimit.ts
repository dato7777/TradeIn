export type LimitResult =
  | { ok: true }
  | { ok: false; retryAfter: number; reason: "limited" | "global" | "unavailable" };

export interface AlertLimiter {
  ip(ipHash: string): Promise<LimitResult>;
  subscribe(ipHash: string, emailHash: string): Promise<LimitResult>;
  tokenRoute(ipHash: string): Promise<LimitResult>;
}

type Bucket = { count: number; resetAt: number };

function hit(map: Map<string, Bucket>, key: string, max: number, windowMs: number, now: number): LimitResult {
  const current = map.get(key);
  if (!current || current.resetAt <= now) {
    if (map.size > 5000) map.clear();
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (current.count >= max) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)), reason: "limited" };
  }
  current.count += 1;
  return { ok: true };
}

export function memoryLimiter(now: () => number = Date.now, maxPerDay = 2000): AlertLimiter {
  const ip10 = new Map<string, Bucket>();
  const ipDay = new Map<string, Bucket>();
  const emailHour = new Map<string, Bucket>();
  const global = new Map<string, Bucket>();
  const token = new Map<string, Bucket>();
  const ip = async (ipHash: string): Promise<LimitResult> => {
    const ipShort = hit(ip10, ipHash, 5, 10 * 60_000, now());
    if (!ipShort.ok) return ipShort;
    return hit(ipDay, ipHash, 20, 24 * 60 * 60_000, now());
  };
  return {
    ip,
    async subscribe(ipHash, emailHash) {
      const ipResult = await ip(ipHash);
      if (!ipResult.ok) return ipResult;
      const email = hit(emailHour, emailHash, 3, 60 * 60_000, now());
      if (!email.ok) return email;
      const cap = hit(global, "confirmations", maxPerDay, 24 * 60 * 60_000, now());
      if (!cap.ok) return { ...cap, reason: "global" };
      return { ok: true };
    },
    async tokenRoute(ipHash) {
      return hit(token, ipHash, 30, 10 * 60_000, now());
    },
  };
}

export const failClosedLimiter: AlertLimiter = {
  async ip() {
    return { ok: false, retryAfter: 60, reason: "unavailable" };
  },
  async subscribe() {
    return { ok: false, retryAfter: 60, reason: "unavailable" };
  },
  async tokenRoute() {
    return { ok: false, retryAfter: 60, reason: "unavailable" };
  },
};

export function upstashLimiter(maxPerDay: number): AlertLimiter {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return failClosedLimiter;
  return {
    async ip(ipHash) {
      try {
        const { Ratelimit } = await import("@upstash/ratelimit");
        const { Redis } = await import("@upstash/redis");
        const redis = new Redis({ url, token });
        const limits = [
          new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "10 m"), prefix: "pa:ip10" }),
          new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 d"), prefix: "pa:ipd" }),
        ];
        const results = await Promise.all(limits.map((item) => item.limit(ipHash)));
        const failed = results.find((item) => !item.success);
        if (!failed) return { ok: true };
        return {
          ok: false,
          retryAfter: Math.max(1, Math.ceil((failed.reset - Date.now()) / 1000)),
          reason: "limited" as const,
        };
      } catch {
        return { ok: false, retryAfter: 60, reason: "unavailable" as const };
      }
    },
    async subscribe(ipHash, emailHash) {
      try {
        const { Ratelimit } = await import("@upstash/ratelimit");
        const { Redis } = await import("@upstash/redis");
        const redis = new Redis({ url, token });
        const limits = [
          new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "10 m"), prefix: "pa:ip10" }),
          new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 d"), prefix: "pa:ipd" }),
          new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3, "1 h"), prefix: "pa:em" }),
          new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(maxPerDay, "1 d"), prefix: "pa:day" }),
        ];
        const keys = [ipHash, ipHash, emailHash, "confirmations"];
        const results = await Promise.all(limits.map((item, index) => item.limit(keys[index] ?? "confirmations")));
        const failed = results.findIndex((item) => !item.success);
        if (failed === -1) return { ok: true };
        const reset = results[failed]?.reset ?? Date.now() + 60_000;
        return {
          ok: false,
          retryAfter: Math.max(1, Math.ceil((reset - Date.now()) / 1000)),
          reason: failed === 3 ? "global" : "limited",
        };
      } catch {
        return { ok: false, retryAfter: 60, reason: "unavailable" };
      }
    },
    async tokenRoute(ipHash) {
      try {
        const { Ratelimit } = await import("@upstash/ratelimit");
        const { Redis } = await import("@upstash/redis");
        const redis = new Redis({ url, token });
        const limit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "10 m"), prefix: "pa:tok" });
        const result = await limit.limit(ipHash);
        if (result.success) return { ok: true };
        return {
          ok: false,
          retryAfter: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
          reason: "limited",
        };
      } catch {
        return { ok: false, retryAfter: 60, reason: "unavailable" };
      }
    },
  };
}
