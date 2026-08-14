/** Simple in-memory rate limits for bot LLM calls (per tenant). */

type Bucket = { times: number[] };

const buckets = new Map<string, Bucket>();

const MAX_PER_MINUTE = 30;
const WINDOW_MS = 60_000;

export function allowBotReply(tenantId: string): boolean {
  const now = Date.now();
  let b = buckets.get(tenantId);
  if (!b) {
    b = { times: [] };
    buckets.set(tenantId, b);
  }
  b.times = b.times.filter((t) => now - t < WINDOW_MS);
  if (b.times.length >= MAX_PER_MINUTE) return false;
  b.times.push(now);
  return true;
}
