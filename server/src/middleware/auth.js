import { User, Session } from '../models/index.js';
import { USER_STATUS } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../services/token.service.js';

const ACTIVE_TOUCH_MS = 5 * 60_000;

/** Resolves the user from a Bearer access token; validates the backing session is still live. */
export async function resolveUserFromToken(token) {
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw ApiError.unauthorized('Session expired.', 'TOKEN_EXPIRED');
    throw ApiError.unauthorized('Invalid session. Please sign in again.', 'TOKEN_INVALID');
  }

  const [user, session] = await Promise.all([
    User.findById(payload.sub).select('-resume -careerKit').lean(false),
    Session.findById(payload.sid).select('revokedAt expiresAt user').lean(),
  ]);

  if (!user || !session || session.revokedAt || session.expiresAt < new Date() || String(session.user) !== String(user._id)) {
    throw ApiError.unauthorized('Your session has ended. Please sign in again.', 'SESSION_REVOKED');
  }
  if (user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.forbidden('Your account is not active. Contact support if you think this is a mistake.', 'ACCOUNT_INACTIVE');
  }
  const changedAt = user.security?.passwordChangedAt;
  if (changedAt && payload.iat * 1000 < changedAt.getTime()) {
    throw ApiError.unauthorized('Password was changed. Please sign in again.', 'PASSWORD_CHANGED');
  }
  return { user, sessionId: payload.sid };
}

export async function authenticate(req, _res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(ApiError.unauthorized());

  const { user, sessionId } = await resolveUserFromToken(token);
  req.user = user;
  req.sessionId = sessionId;

  // Throttled "last active" tracking for admin/mentor dashboards.
  if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > ACTIVE_TOUCH_MS) {
    User.updateOne({ _id: user._id }, { lastActiveAt: new Date() }).catch(() => {});
  }
  next();
}

/** Authenticates when a token is present, otherwise continues as a guest. */
export function optionalAuth(req, res, next) {
  if (!req.get('authorization')) return next();
  return authenticate(req, res, next);
}

export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };

/** CSRF defence-in-depth for cookie-authenticated endpoints: a custom header forces a CORS preflight. */
export function requireAjaxHeader(req, _res, next) {
  if (req.get('x-requested-with') !== 'XMLHttpRequest') {
    return next(ApiError.forbidden('Missing request header.', 'CSRF'));
  }
  next();
}
