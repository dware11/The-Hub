import { createHash } from 'node:crypto';

const STORE_KEY = Symbol.for('code-hub.request-rate-limits');
const store = globalThis[STORE_KEY] || new Map();
globalThis[STORE_KEY] = store;

export function requestFingerprint(headerStore, fallback = 'unknown') {
  const forwarded = headerStore?.get?.('x-forwarded-for')?.split(',')[0]?.trim();
  const value = forwarded || headerStore?.get?.('x-real-ip')?.trim() || fallback;
  return createHash('sha256').update(value).digest('hex');
}

// A deliberately small V1 burst guard. It is enforced inside each warm Vercel
// runtime; a distributed WAF/edge rule can replace it later without changing
// application behavior.
export function consumeRateLimit(scope, identity, { limit, windowMs }) {
  const now = Date.now();
  const key = `${scope}:${identity}`;
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;

  if (store.size > 5000) {
    for (const [entryKey, entry] of store) {
      if (entry.resetAt <= now) store.delete(entryKey);
    }
  }
  return true;
}
