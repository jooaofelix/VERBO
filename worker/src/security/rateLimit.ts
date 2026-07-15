const WINDOW_MS = 60 * 60 * 1000;

interface Counter {
  windowStart: number;
  count: number;
}

/**
 * Per-uid, per-action counter held in module-level memory (no D1/KV/R2 —
 * this MVP has no persistent datastore beyond Firestore, which the Worker
 * never touches). This is a best-effort guard against runaway loops within
 * a single Worker isolate, not a durable rate limit: a new isolate (cold
 * start, redeploy, or a request landing on a different edge location)
 * starts its counters over. Good enough to blunt accidental abuse; not a
 * substitute for a real quota system if this ever needs hard guarantees.
 */
const counters = new Map<string, Counter>();

export function isWithinRateLimit(key: string, maxCallsPerWindow: number, now = Date.now()): boolean {
  const existing = counters.get(key);

  if (!existing || now - existing.windowStart > WINDOW_MS) {
    counters.set(key, { windowStart: now, count: 1 });
    return true;
  }

  if (existing.count >= maxCallsPerWindow) {
    return false;
  }

  existing.count += 1;
  return true;
}

/** Exposed only for tests. */
export function resetRateLimitForTests(): void {
  counters.clear();
}
