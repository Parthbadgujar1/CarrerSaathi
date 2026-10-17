import { monitorEventLoopDelay } from 'node:perf_hooks';
import { env } from '../config/env.js';
import { isDbReady } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

// ---- Load shedding -------------------------------------------------------
// When the event loop is saturated, answering new requests only makes things
// worse. We sample event-loop delay and reply 503 + Retry-After early so the
// server stays responsive for in-flight work and health checks.
const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

let currentLagMs = 0;
const sampler = setInterval(() => {
  currentLagMs = histogram.mean / 1e6;
  histogram.reset();
}, 1000);
sampler.unref();

export const getEventLoopLag = () => Math.round(currentLagMs);

export function loadShedding(req, res, next) {
  if (currentLagMs > env.LOAD_SHED_LAG_MS) {
    res.setHeader('Retry-After', '5');
    return next(ApiError.unavailable('Server is busy right now. Please retry in a few seconds.', 'SERVER_BUSY'));
  }
  next();
}

// ---- Database guard ------------------------------------------------------
/** Returns a clear 503 instead of hanging when MongoDB is unreachable. */
export function dbGuard(req, res, next) {
  if (!isDbReady()) {
    res.setHeader('Retry-After', '10');
    return next(ApiError.unavailable('Database is temporarily unavailable. Please try again shortly.', 'DB_UNAVAILABLE'));
  }
  next();
}

// ---- Request timeout -----------------------------------------------------
export function requestTimeout(ms = 30_000) {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) next(new ApiError(503, 'The request took too long. Please try again.', 'TIMEOUT'));
    }, ms);
    timer.unref();
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));
    next();
  };
}
