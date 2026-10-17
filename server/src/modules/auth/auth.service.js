import { User, DeletionRequest } from '../../models/index.js';
import { env } from '../../config/env.js';
import { LEGAL_VERSIONS, ROLES, USER_STATUS } from '../../config/constants.js';
import { ApiError } from '../../utils/ApiError.js';
import { randomToken } from '../../utils/helpers.js';
import { sendEmail } from '../../services/email/email.service.js';
import { createOneTimeToken, consumeOneTimeToken, revokeAllSessions } from '../../services/token.service.js';
import { getSettings } from '../../services/settings.service.js';
import { notify } from '../../services/notification.service.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

function consentFields(consents) {
  return {
    termsVersion: LEGAL_VERSIONS.terms,
    privacyVersion: LEGAL_VERSIONS.privacy,
    acceptedAt: new Date(),
    marketingEmails: Boolean(consents?.marketingEmails),
  };
}

export async function sendVerification(user) {
  const token = await createOneTimeToken(user._id, 'verify_email');
  await sendEmail(user.email, 'verifyEmail', { name: user.name, url: `${env.CLIENT_URL}/verify-email/${token}` });
}

export async function registerStudent(data) {
  const settings = await getSettings();
  if (!settings.registrationOpen) throw ApiError.forbidden('New registrations are temporarily closed.', 'REGISTRATION_CLOSED');
  if (await User.exists({ email: data.email })) throw ApiError.conflict('An account with this email already exists.', 'DUPLICATE');

  const user = await User.create({
    name: data.name,
    email: data.email,
    password: data.password,
    phone: data.phone,
    role: ROLES.STUDENT,
    education: data.education,
    careerTracks: data.careerTracks,
    consents: consentFields(data.consents),
    acquisition: data.utm || {},
    unsubscribeToken: randomToken(24),
  });
  await sendVerification(user);
  return user;
}

export async function applyAsMentor(data) {
  const settings = await getSettings();
  if (!settings.mentorApplicationsOpen) throw ApiError.forbidden('Mentor applications are currently closed.', 'APPLICATIONS_CLOSED');
  if (await User.exists({ email: data.email })) throw ApiError.conflict('An account with this email already exists.', 'DUPLICATE');

  const user = await User.create({
    name: data.name,
    email: data.email,
    password: data.password,
    phone: data.phone,
    role: ROLES.MENTOR,
    status: USER_STATUS.PENDING,
    bio: data.bio,
    links: { linkedin: data.linkedin || '' },
    mentorProfile: data.mentorProfile,
    consents: consentFields(data.consents),
    unsubscribeToken: randomToken(24),
  });
  await sendVerification(user);
  const admins = await User.find({ role: ROLES.ADMIN, status: USER_STATUS.ACTIVE }).select('_id').lean();
  notify(
    admins.map((a) => a._id),
    { type: 'mentor_application', title: 'New mentor application', body: `${user.name} applied to become a mentor.`, link: '/admin/mentors?status=pending' },
  );
  return user;
}

/**
 * Verifies credentials with account lockout. Uses the same error message for
 * unknown email and wrong password to prevent account enumeration.
 */
export async function verifyCredentials(email, password) {
  const user = await User.findOne({ email }).select('+password');
  const invalid = ApiError.unauthorized('Incorrect email or password.', 'INVALID_CREDENTIALS');
  if (!user) {
    // Equalise timing with the bcrypt path.
    await new Promise((r) => setTimeout(r, 120));
    throw invalid;
  }
  if (user.isLocked()) {
    const mins = Math.ceil((user.security.lockUntil - Date.now()) / 60_000);
    throw new ApiError(423, `Too many failed attempts. Try again in ${mins} minute(s) or reset your password.`, 'ACCOUNT_LOCKED');
  }
  const ok = await user.comparePassword(password);
  if (!ok) {
    user.security.failedLoginAttempts = (user.security.failedLoginAttempts || 0) + 1;
    if (user.security.failedLoginAttempts >= MAX_FAILED_LOGINS) {
      user.security.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
      user.security.failedLoginAttempts = 0;
    }
    await user.save({ validateModifiedOnly: true });
    throw invalid;
  }

  if (user.status === USER_STATUS.PENDING) {
    throw ApiError.forbidden(
      user.role === ROLES.MENTOR ? 'Your mentor application is awaiting admin approval. We will email you once approved.' : 'Your account is not active yet.',
      'ACCOUNT_PENDING',
    );
  }
  if (user.status === USER_STATUS.SUSPENDED) {
    throw ApiError.forbidden('Your account has been suspended. Please contact support.', 'ACCOUNT_SUSPENDED');
  }

  let restored = false;
  if (user.status === USER_STATUS.DELETION_PENDING) {
    // Signing in during the grace period cancels the deletion request.
    user.status = USER_STATUS.ACTIVE;
    user.deletion = {};
    await DeletionRequest.updateMany({ user: user._id, status: 'pending' }, { status: 'cancelled', processedAt: new Date() });
    restored = true;
  }

  user.security.failedLoginAttempts = 0;
  user.security.lockUntil = undefined;
  user.security.lastLoginAt = new Date();
  await user.save({ validateModifiedOnly: true });
  return { user, restored };
}

export async function requestPasswordReset(email) {
  const user = await User.findOne({ email, status: { $ne: USER_STATUS.SUSPENDED } });
  if (!user) return; // silent — never reveal whether an email is registered
  const token = await createOneTimeToken(user._id, 'reset_password');
  await sendEmail(user.email, 'resetPassword', { name: user.name, url: `${env.CLIENT_URL}/reset-password/${token}` });
}

export async function resetPassword(token, password) {
  const userId = await consumeOneTimeToken(token, 'reset_password');
  const user = await User.findById(userId);
  if (!user) throw ApiError.badRequest('This link is invalid or has expired.', undefined, 'TOKEN_INVALID');
  user.password = password;
  user.emailVerified = true; // they proved inbox ownership
  user.security.failedLoginAttempts = 0;
  user.security.lockUntil = undefined;
  await user.save();
  await revokeAllSessions(user._id, 'password_reset');
  await sendEmail(user.email, 'passwordChanged', { name: user.name });
}

export async function verifyEmail(token) {
  const userId = await consumeOneTimeToken(token, 'verify_email');
  await User.updateOne({ _id: userId }, { emailVerified: true });
}

/** Mentor invite acceptance: sets the password and activates the account. */
export async function acceptInvite(token, password) {
  const userId = await consumeOneTimeToken(token, 'invite');
  const user = await User.findById(userId);
  if (!user) throw ApiError.badRequest('This invitation is invalid or has expired.', undefined, 'TOKEN_INVALID');
  user.password = password;
  user.status = USER_STATUS.ACTIVE;
  user.emailVerified = true;
  user.consents = { ...user.consents, termsVersion: LEGAL_VERSIONS.terms, privacyVersion: LEGAL_VERSIONS.privacy, acceptedAt: new Date() };
  await user.save();
  return user;
}

export async function changePassword(user, currentPassword, newPassword, keepSessionId) {
  const fresh = await User.findById(user._id).select('+password');
  if (!(await fresh.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Current password is incorrect.', [{ field: 'currentPassword', message: 'Incorrect password' }], 'INVALID_PASSWORD');
  }
  if (currentPassword === newPassword) throw ApiError.badRequest('New password must be different from the current one.');
  fresh.password = newPassword;
  await fresh.save();
  await revokeAllSessions(user._id, 'password_change', keepSessionId);
  await sendEmail(fresh.email, 'passwordChanged', { name: fresh.name });
}
