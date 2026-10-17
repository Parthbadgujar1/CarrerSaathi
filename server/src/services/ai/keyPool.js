/**
 * Key pool with round-robin rotation and a per-key circuit breaker.
 * - invalid key (401/403)     → parked for 1 hour
 * - rate limited (429)        → parked for Retry-After (default 60 s)
 * - server/timeout errors     → parked for 30 s after 2 consecutive failures
 * A parked key is skipped, so one bad key never slows down requests.
 */
import { getAiOrder, getProviderConfig } from './aiConfig.service.js';
import { sha256 } from '../../utils/helpers.js';

const state = new Map(); // keyId -> { failures, openUntil, lastError, lastOkAt, calls, errors }
const cursor = new Map(); // provider -> next index

const keyId = (provider, key) => `${provider}:${sha256(key).slice(0, 10)}`;

function stats(id) {
  if (!state.has(id)) state.set(id, { failures: 0, openUntil: 0, lastError: null, lastOkAt: null, calls: 0, errors: 0 });
  return state.get(id);
}

export function configuredProviders() {
  return getAiOrder().filter((p) => getProviderConfig(p).keys.length);
}

/** Healthy keys for a provider, starting from the round-robin cursor. */
export function availableKeys(provider) {
  const keys = getProviderConfig(provider).keys;
  if (!keys.length) return [];
  const start = (cursor.get(provider) || 0) % keys.length;
  cursor.set(provider, start + 1);
  const ordered = [...keys.slice(start), ...keys.slice(0, start)];
  const now = Date.now();
  return ordered.filter((k) => stats(keyId(provider, k)).openUntil <= now);
}

export function reportSuccess(provider, key) {
  const s = stats(keyId(provider, key));
  s.failures = 0;
  s.openUntil = 0;
  s.lastOkAt = new Date();
  s.calls += 1;
}

export function reportFailure(provider, key, err) {
  const s = stats(keyId(provider, key));
  s.calls += 1;
  s.errors += 1;
  s.failures += 1;
  s.lastError = `${err.kind || 'error'}: ${err.message}`.slice(0, 200);
  const now = Date.now();
  if (err.kind === 'auth') s.openUntil = now + 60 * 60_000;
  else if (err.kind === 'rate') s.openUntil = now + (err.retryAfterMs || 60_000);
  else if (s.failures >= 2) s.openUntil = now + 30_000;
}

/** Snapshot for the admin dashboard — never exposes the keys themselves. */
export function poolStatus() {
  const now = Date.now();
  return getAiOrder().map((provider) => {
    const keys = getProviderConfig(provider).keys;
    return {
      provider,
      model: getProviderConfig(provider).model,
      configured: keys.length > 0,
      keys: keys.map((k, i) => {
        const s = stats(keyId(provider, k));
        return {
          label: `Key ${i + 1} (…${k.slice(-4)})`,
          healthy: s.openUntil <= now,
          cooldownSeconds: s.openUntil > now ? Math.ceil((s.openUntil - now) / 1000) : 0,
          calls: s.calls,
          errors: s.errors,
          lastError: s.lastError,
          lastOkAt: s.lastOkAt,
        };
      }),
    };
  });
}

export function resetPool() {
  state.clear();
}
