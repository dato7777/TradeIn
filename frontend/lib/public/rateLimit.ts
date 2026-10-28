const hits = new Map<string, { count: number; resetAt: number }>();

/** Best-effort limit for one server instance. A shared store replaces this in a later phase. */
export function allowSearch(ip: string, now = Date.now()): boolean {
  const windowMs = 60_000;
  const max = 30;
  const current = hits.get(ip);
  if (!current || current.resetAt <= now) {
    if (hits.size > 5000) hits.clear();
    hits.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= max;
}
