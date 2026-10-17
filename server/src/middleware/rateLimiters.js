import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';

const handler = (req, res, _next, options) => {
  res.status(options.statusCode).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: options.message, requestId: req.id },
  });
};

const make = ({ windowMs, limit, message, keyGenerator, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    limit: env.isTest ? 10_000 : limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message,
    handler,
    keyGenerator,
    skipSuccessfulRequests,
  });

/** Broad per-IP protection for the whole API. */
export const apiLimiter = make({
  windowMs: 15 * 60_000,
  limit: 1500,
  message: 'Too many requests from this network. Please wait a few minutes.',
});

/** Login: keyed by IP + email, only failed attempts count. */
export const loginLimiter = make({
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts. Please wait 15 minutes and try again.',
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email || '').toLowerCase()}`,
});

export const registerLimiter = make({
  windowMs: 60 * 60_000,
  limit: 10,
  message: 'Too many sign-ups from this network. Please try again later.',
});

/** Account-security endpoints: counted per IP *and* per endpoint, so one flow can't exhaust another. */
export const sensitiveLimiter = make({
  windowMs: 60 * 60_000,
  limit: 10,
  message: 'Too many requests. Please try again in an hour.',
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${req.baseUrl}${req.route?.path || req.path}`,
});

export const contactLimiter = make({
  windowMs: 60 * 60_000,
  limit: 5,
  message: 'You have sent several messages already. Please try again later.',
});

/** AI calls are per-user (falls back to IP). Daily quotas are enforced separately. */
export const aiLimiter = make({
  windowMs: 10 * 60_000,
  limit: 20,
  message: 'You are sending AI requests too quickly. Please wait a few minutes.',
  keyGenerator: (req) => (req.user ? `u:${req.user._id}` : ipKeyGenerator(req.ip)),
});
