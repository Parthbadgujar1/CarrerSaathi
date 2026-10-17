/**
 * Strips MongoDB operator keys (`$gt`, `$where`, ...) and dotted keys from
 * user input to prevent NoSQL injection. Written in-house because popular
 * packages are not compatible with Express 5's read-only `req.query`.
 */
const FORBIDDEN_KEY = /^\$|\./;

function clean(value, depth = 0) {
  if (depth > 10 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key) || key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    out[key] = clean(v, depth + 1);
  }
  return out;
}

export function sanitizeInput(req, _res, next) {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body);
  if (req.params) req.params = clean(req.params);
  // Express 5 exposes req.query as a getter; replace it with a sanitized, flat copy.
  const query = clean(req.query || {});
  // Collapse repeated params (?a=1&a=2) to the last value — HTTP parameter pollution guard.
  for (const [k, v] of Object.entries(query)) {
    if (Array.isArray(v)) query[k] = v[v.length - 1];
  }
  Object.defineProperty(req, 'query', { value: query, writable: true, configurable: true, enumerable: true });
  next();
}
