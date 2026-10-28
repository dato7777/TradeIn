const searchHits = new Map<string, { count: number; resetAt: number }>();
const clickHits = new Map<string, { count: number; resetAt: number }>();

function allow(bucket: Map<string, { count: number; resetAt: number }>, ip: string, max: number, now: number) {
  const windowMs = 60_000;
  const current = bucket.get(ip);
  if (!current || current.resetAt <= now) {
    if (bucket.size > 5000) bucket.clear();
    bucket.set(ip, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  current.count += 1;
  return {
    ok: current.count <= max,
    retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

/** First address in X-Forwarded-For, or null when it is missing or not an IP. */
export function clientIp(header: string | null): string | null {
  const first = header?.split(",")[0]?.trim() ?? "";
  if (first.length < 3 || first.length > 64) return null;
  if (!/^[0-9a-fA-F:.]+$/.test(first)) return null;
  return first;
}

/** Best-effort limit for one server instance. A shared store replaces this in a later phase. */
export function allowSearch(ip: string, now = Date.now()): boolean {
  return allow(searchHits, ip, 30, now).ok;
}

/** 30 real clicks a minute per IP, separate from search. */
export function allowClick(ip: string, now = Date.now()): { ok: boolean; retryAfter: number } {
  return allow(clickHits, ip, 30, now);
}
