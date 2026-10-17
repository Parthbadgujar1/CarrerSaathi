import crypto from 'node:crypto';
import { logger } from '../config/logger.js';

/** Attaches a request id (echoed in the X-Request-Id header and in error bodies) for tracing. */
export function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

/** Lightweight access log: method, path, status, duration — never bodies or secrets. */
export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'http';
    logger.log(level, `${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${ms.toFixed(0)}ms`, {
      requestId: req.id,
      userId: req.user?._id?.toString(),
    });
  });
  next();
}
