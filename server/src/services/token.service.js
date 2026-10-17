import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Session, Token } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sha256, randomToken } from '../utils/helpers.js';

export const REFRESH_COOKIE = 'cs_rt';
const JWT_OPTS = { issuer: 'careersaathi', audience: 'careersaathi-web' };
const ROTATION_GRACE_MS = 30_000; // tolerate parallel refreshes from multiple tabs

// ---- Access tokens (short-lived JWT, kept in memory by the client) ----------
export function signAccessToken(user, sessionId) {
  return jwt.sign({ sub: user._id.toString(), role: user.role, sid: sessionId.toString() }, env.JWT_ACCESS_SECRET, {
    ...JWT_OPTS,
    algorithm: 'HS256',
    expiresIn: env.JWT_ACCESS_TTL,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { ...JWT_OPTS, algorithms: ['HS256'] });
}

// ---- Refresh tokens (httpOnly cookie, rotated on every use) ---------------
const ipHint = (ip = '') => (ip.includes(':') ? ip.split(':').slice(0, 3).join(':') + ':…' : ip.split('.').slice(0, 2).join('.') + '.x.x');

export async function createSession(user, req, remember = false) {
  const days = remember ? env.REFRESH_TTL_REMEMBER_DAYS : env.REFRESH_TTL_DAYS;
  const secret = randomToken(48);
  const session = new Session({
    user: user._id,
    tokenHash: 'pending',
    userAgent: String(req.get('user-agent') || '').slice(0, 300),
    ipHint: ipHint(req.ip),
    remember,
    expiresAt: new Date(Date.now() + days * 86_400_000),
  });
  const refreshToken = `${session._id}.${secret}`;
  session.tokenHash = sha256(refreshToken);
  await session.save();
  return { session, refreshToken };
}

/**
 * Rotates a refresh token. Presenting an already-rotated token outside the
 * grace window means it was stolen and replayed, so the session is revoked.
 */
export async function rotateRefreshToken(rawToken, req) {
  const [sessionId] = String(rawToken || '').split('.');
  if (!/^[a-f\d]{24}$/i.test(sessionId || '')) throw ApiError.unauthorized('Session expired. Please sign in again.', 'REFRESH_INVALID');

  const session = await Session.findById(sessionId);
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw ApiError.unauthorized('Session expired. Please sign in again.', 'REFRESH_INVALID');
  }

  const presented = sha256(rawToken);
  if (presented !== session.tokenHash) {
    const withinGrace = presented === session.prevTokenHash && session.rotatedAt && Date.now() - session.rotatedAt.getTime() < ROTATION_GRACE_MS;
    if (withinGrace) return { session, refreshToken: null };
    session.revokedAt = new Date();
    session.revokedReason = 'refresh_token_reuse';
    await session.save();
    logger.warn('Refresh token reuse detected — session revoked', { sessionId, userId: session.user.toString() });
    throw ApiError.unauthorized('Your session was ended for security reasons. Please sign in again.', 'REFRESH_REUSED');
  }

  const refreshToken = `${session._id}.${randomToken(48)}`;
  session.prevTokenHash = session.tokenHash;
  session.tokenHash = sha256(refreshToken);
  session.rotatedAt = new Date();
  session.lastUsedAt = new Date();
  session.userAgent = String(req.get('user-agent') || session.userAgent).slice(0, 300);
  await session.save();
  return { session, refreshToken };
}

export async function revokeSession(sessionId, reason = 'logout') {
  await Session.updateOne({ _id: sessionId, revokedAt: null }, { revokedAt: new Date(), revokedReason: reason });
}

export async function revokeAllSessions(userId, reason = 'logout_all', exceptSessionId) {
  const filter = { user: userId, revokedAt: null };
  if (exceptSessionId) filter._id = { $ne: exceptSessionId };
  await Session.updateMany(filter, { revokedAt: new Date(), revokedReason: reason });
}

export function setRefreshCookie(res, token, session) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'strict',
    path: '/api/v1/auth',
    // Session cookie unless "remember me" — closing the browser ends non-remembered sessions.
    ...(session.remember ? { expires: session.expiresAt } : {}),
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: env.isProd, sameSite: 'strict', path: '/api/v1/auth' });
}

// ---- One-time tokens (email verification, password reset, invites) --------
const TTL_MINUTES = { verify_email: 60 * 48, reset_password: 30, invite: 60 * 72 };

export async function createOneTimeToken(userId, type) {
  await Token.deleteMany({ user: userId, type }); // only the latest link works
  const raw = crypto.randomBytes(32).toString('base64url');
  await Token.create({
    user: userId,
    type,
    tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + TTL_MINUTES[type] * 60_000),
  });
  return raw;
}

export async function consumeOneTimeToken(raw, type) {
  const token = await Token.findOneAndUpdate(
    { tokenHash: sha256(raw || ''), type, usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() },
    { new: true },
  );
  if (!token) throw ApiError.badRequest('This link is invalid or has expired. Please request a new one.', undefined, 'TOKEN_INVALID');
  return token.user;
}
