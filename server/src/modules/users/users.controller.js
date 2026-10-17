import { User, Session, DeletionRequest } from '../../models/index.js';
import { env } from '../../config/env.js';
import { DELETION_GRACE_DAYS, ROLES, USER_STATUS } from '../../config/constants.js';
import { ApiError } from '../../utils/ApiError.js';
import { addDays } from '../../utils/helpers.js';
import { clearRefreshCookie, revokeAllSessions, revokeSession } from '../../services/token.service.js';
import { exportUserData } from '../../services/userData.service.js';
import { sendEmail } from '../../services/email/email.service.js';
import { refreshReadiness } from '../../services/readiness.service.js';

/** Flattens nested objects to dotted paths so partial updates don't wipe sibling fields. */
function toDotted(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) toDotted(v, path, out);
    else if (v !== undefined) out[path] = v;
  }
  return out;
}

export async function updateProfile(req, res) {
  const body = { ...req.body };
  if (req.user.role !== ROLES.MENTOR) delete body.mentorProfile;
  const user = await User.findByIdAndUpdate(req.user._id, { $set: toDotted(body) }, { new: true, runValidators: true });
  if (user.role === ROLES.STUDENT) refreshReadiness(user._id);
  res.json({ success: true, data: { user }, message: 'Profile saved.' });
}

export async function updatePreferences(req, res) {
  const set = {};
  if (req.body.marketingEmails !== undefined) set['consents.marketingEmails'] = req.body.marketingEmails;
  if (req.body.wellnessShareWithMentor !== undefined) set['consents.wellnessShareWithMentor'] = req.body.wellnessShareWithMentor;
  if (req.body.emailNotifications !== undefined) set['preferences.emailNotifications'] = req.body.emailNotifications;
  const user = await User.findByIdAndUpdate(req.user._id, { $set: set }, { new: true });
  res.json({ success: true, data: { user }, message: 'Preferences updated.' });
}

export async function listSessions(req, res) {
  const sessions = await Session.find({ user: req.user._id, revokedAt: null, expiresAt: { $gt: new Date() } })
    .select('userAgent ipHint createdAt lastUsedAt remember')
    .sort({ lastUsedAt: -1 })
    .lean();
  res.json({
    success: true,
    data: sessions.map((s) => ({ ...s, current: String(s._id) === String(req.sessionId) })),
  });
}

export async function revokeOneSession(req, res) {
  const session = await Session.findOne({ _id: req.params.id, user: req.user._id });
  if (!session) throw ApiError.notFound('Session not found.');
  await revokeSession(session._id, 'user_revoked');
  res.json({ success: true, message: 'Device signed out.' });
}

export async function exportData(req, res) {
  const data = await exportUserData(req.user._id);
  res.setHeader('Content-Disposition', `attachment; filename="careersaathi-my-data-${Date.now()}.json"`);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(data, null, 2));
}

/** Schedules erasure after a grace period; signing in again cancels it. */
export async function requestDeletion(req, res) {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(req.body.password))) {
    throw ApiError.badRequest('Password is incorrect.', [{ field: 'password', message: 'Incorrect password' }], 'INVALID_PASSWORD');
  }
  if (user.role === ROLES.ADMIN && (await User.countDocuments({ role: ROLES.ADMIN, status: USER_STATUS.ACTIVE })) <= 1) {
    throw ApiError.badRequest('You are the only admin. Promote another admin before deleting this account.');
  }
  const scheduledFor = addDays(new Date(), DELETION_GRACE_DAYS);
  user.status = USER_STATUS.DELETION_PENDING;
  user.deletion = { requestedAt: new Date(), scheduledFor, reason: req.body.reason };
  await user.save({ validateModifiedOnly: true });
  await DeletionRequest.create({ user: user._id, email: user.email, reason: req.body.reason, scheduledFor });
  await revokeAllSessions(user._id, 'deletion_requested');
  await sendEmail(user.email, 'deletionScheduled', {
    name: user.name,
    date: scheduledFor.toDateString(),
    url: `${env.CLIENT_URL}/login`,
  });
  clearRefreshCookie(res);
  res.json({
    success: true,
    message: `Your account is scheduled for deletion on ${scheduledFor.toDateString()}. Sign in before then to cancel.`,
  });
}

/** One-click unsubscribe from marketing email (no login needed). */
export async function unsubscribe(req, res) {
  const result = await User.updateOne({ unsubscribeToken: req.body.token }, { 'consents.marketingEmails': false });
  if (!result.matchedCount) throw ApiError.badRequest('This unsubscribe link is invalid.', undefined, 'TOKEN_INVALID');
  res.json({ success: true, message: 'You have been unsubscribed from announcement emails.' });
}
