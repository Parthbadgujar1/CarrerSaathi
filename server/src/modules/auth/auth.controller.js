import { REFRESH_COOKIE, clearRefreshCookie, createSession, revokeAllSessions, revokeSession, rotateRefreshToken, setRefreshCookie, signAccessToken } from '../../services/token.service.js';
import { User } from '../../models/index.js';
import { USER_STATUS } from '../../config/constants.js';
import { ApiError } from '../../utils/ApiError.js';
import * as authService from './auth.service.js';

async function startSession(req, res, user, remember = false) {
  const { session, refreshToken } = await createSession(user, req, remember);
  setRefreshCookie(res, refreshToken, session);
  return signAccessToken(user, session._id);
}

export async function register(req, res) {
  const user = await authService.registerStudent(req.body);
  const accessToken = await startSession(req, res, user);
  res.status(201).json({ success: true, data: { user, accessToken }, message: 'Account created. Please verify your email.' });
}

export async function applyMentor(req, res) {
  await authService.applyAsMentor(req.body);
  res.status(201).json({
    success: true,
    message: 'Application received! An admin will review it and you will get an email once approved.',
  });
}

export async function login(req, res) {
  const { user, restored } = await authService.verifyCredentials(req.body.email, req.body.password);
  const accessToken = await startSession(req, res, user, req.body.remember);
  res.json({
    success: true,
    data: { user, accessToken },
    message: restored ? 'Welcome back! Your account deletion request has been cancelled.' : undefined,
  });
}

export async function refresh(req, res) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  // A visitor who was never signed in is not an error — answer quietly so guest page loads stay clean.
  if (!raw) return res.status(204).end();
  try {
    const { session, refreshToken } = await rotateRefreshToken(raw, req);
    const user = await User.findById(session.user);
    if (!user || user.status !== USER_STATUS.ACTIVE) {
      await revokeSession(session._id, 'inactive_account');
      throw ApiError.unauthorized('Your account is not active.', 'ACCOUNT_INACTIVE');
    }
    if (refreshToken) setRefreshCookie(res, refreshToken, session);
    res.json({ success: true, data: { user, accessToken: signAccessToken(user, session._id) } });
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
}

export async function logout(req, res) {
  const raw = req.cookies?.[REFRESH_COOKIE];
  const [sessionId] = String(raw || '').split('.');
  if (/^[a-f\d]{24}$/i.test(sessionId || '')) await revokeSession(sessionId, 'logout');
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Signed out.' });
}

export async function logoutAll(req, res) {
  await revokeAllSessions(req.user._id, 'logout_all');
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Signed out from all devices.' });
}

export async function me(req, res) {
  const user = await User.findById(req.user._id);
  res.json({ success: true, data: { user } });
}

export async function forgotPassword(req, res) {
  await authService.requestPasswordReset(req.body.email);
  res.json({ success: true, message: 'If an account exists for that email, a reset link has been sent.' });
}

export async function resetPassword(req, res) {
  await authService.resetPassword(req.body.token, req.body.password);
  clearRefreshCookie(res);
  res.json({ success: true, message: 'Password updated. Please sign in with your new password.' });
}

export async function verifyEmail(req, res) {
  await authService.verifyEmail(req.body.token);
  res.json({ success: true, message: 'Email verified. Thank you!' });
}

export async function resendVerification(req, res) {
  if (req.user.emailVerified) return res.json({ success: true, message: 'Your email is already verified.' });
  await authService.sendVerification(req.user);
  res.json({ success: true, message: 'Verification email sent. Please check your inbox.' });
}

export async function acceptInvite(req, res) {
  const user = await authService.acceptInvite(req.body.token, req.body.password);
  const accessToken = await startSession(req, res, user);
  res.json({ success: true, data: { user, accessToken }, message: 'Your account is active. Welcome aboard!' });
}

export async function changePassword(req, res) {
  await authService.changePassword(req.user, req.body.currentPassword, req.body.newPassword, req.sessionId);
  // passwordChangedAt invalidates older access tokens, so hand the current device a fresh one.
  const accessToken = signAccessToken(req.user, req.sessionId);
  res.json({ success: true, data: { accessToken }, message: 'Password changed. Other devices have been signed out.' });
}
