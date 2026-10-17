import {
  User, Mentorship, Enrollment, Application, AuditLog, ContactMessage, DeletionRequest, EmailOutbox, WellnessLog,
} from '../../models/index.js';
import { env } from '../../config/env.js';
import { ROLES, USER_STATUS } from '../../config/constants.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, paginated, randomToken, escapeRegex } from '../../utils/helpers.js';
import { audit } from '../../services/audit.service.js';
import { notify } from '../../services/notification.service.js';
import { sendEmail } from '../../services/email/email.service.js';
import { createOneTimeToken, revokeAllSessions } from '../../services/token.service.js';
import { getSettings, updateSettings } from '../../services/settings.service.js';
import { purgeUser } from '../../services/userData.service.js';
import { computeReadiness } from '../../services/readiness.service.js';
import { aiStatus, testProvider, clearAiCache } from '../../services/ai/ai.service.js';
import { addKey, listKeys, removeKey, setModels } from '../../services/ai/aiConfig.service.js';
import { resetPool } from '../../services/ai/keyPool.js';
import { getOrCreateDirect } from '../chat/chat.service.js';
import { buildStudentFilter, dashboardStats, SORTS, streamStudentsExcel } from './admin.service.js';
import { STUDENT_EXPORT_FIELDS } from './admin.validation.js';

export async function stats(_req, res) {
  res.json({ success: true, data: await dashboardStats() });
}

// ---------------------------------------------------------------- students
export async function listStudents(req, res) {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 25 });
  const filter = buildStudentFilter(req.query);
  const [items, total] = await Promise.all([
    User.find(filter)
      .select('name email phone emailVerified status education careerTracks readinessScore lastActiveAt createdAt address.city address.state acquisition.utmSource')
      .sort(SORTS[req.query.sort])
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginated(items, total, { page, limit }) });
}

export async function exportStudents(req, res) {
  const filename = `careersaathi-students-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const count = await streamStudentsExcel(res, req.body);
  audit(req, 'students.export', { meta: { count, fields: req.body.fields, selected: req.body.ids.length } });
}

export function exportFields(_req, res) {
  res.json({ success: true, data: Object.entries(STUDENT_EXPORT_FIELDS).map(([key, label]) => ({ key, label })) });
}

export async function userDetail(req, res) {
  const user = await User.findById(req.params.id).lean();
  if (!user) throw ApiError.notFound('User not found.');
  delete user.password;
  delete user.unsubscribeToken;
  const payload = { user };
  if (user.role === ROLES.STUDENT) {
    const [enrollments, readiness, applications, mentorships, checkins] = await Promise.all([
      Enrollment.find({ user: user._id }).populate('roadmap', 'title slug').lean(),
      computeReadiness(user._id),
      Application.find({ user: user._id }).populate('opportunity', 'title organization type').lean(),
      Mentorship.find({ student: user._id }).populate('mentor', 'name email').lean(),
      WellnessLog.countDocuments({ user: user._id }),
    ]);
    Object.assign(payload, { enrollments, readiness, applications, mentorships, wellnessCheckins: checkins });
  } else if (user.role === ROLES.MENTOR) {
    payload.mentees = await Mentorship.find({ mentor: user._id, status: { $in: ['active', 'pending'] } })
      .populate('student', 'name email education.college readinessScore')
      .lean();
  }
  res.json({ success: true, data: payload });
}

export async function setUserStatus(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');
  if (String(user._id) === String(req.user._id)) throw ApiError.badRequest('You cannot change your own status.');
  user.status = req.body.status;
  await user.save({ validateModifiedOnly: true });
  if (req.body.status === USER_STATUS.SUSPENDED) await revokeAllSessions(user._id, 'suspended');
  audit(req, `user.${req.body.status}`, { targetType: 'user', targetId: user._id, meta: { reason: req.body.reason } });
  res.json({ success: true, data: { status: user.status }, message: `User ${req.body.status === 'active' ? 'activated' : 'suspended'}.` });
}

export async function deleteUser(req, res) {
  if (String(req.params.id) === String(req.user._id)) throw ApiError.badRequest('Use account settings to delete your own account.');
  const target = await User.findById(req.params.id).select('role email').lean();
  if (!target) throw ApiError.notFound('User not found.');
  if (target.role === ROLES.ADMIN && (await User.countDocuments({ role: ROLES.ADMIN, status: USER_STATUS.ACTIVE })) <= 1) {
    throw ApiError.badRequest('Cannot delete the last admin.');
  }
  const purged = await purgeUser(req.params.id);
  audit(req, 'user.delete', { targetType: 'user', targetId: req.params.id, meta: { email: target.email, role: target.role } });
  if (purged) sendEmail(purged.email, 'deletionCompleted', { name: purged.name });
  res.json({ success: true, message: 'User and their data were permanently deleted.' });
}

export async function assignMentor(req, res) {
  const [student, mentor] = await Promise.all([
    User.findOne({ _id: req.body.studentId, role: ROLES.STUDENT, status: USER_STATUS.ACTIVE }),
    User.findOne({ _id: req.body.mentorId, role: ROLES.MENTOR, status: USER_STATUS.ACTIVE }),
  ]);
  if (!student || !mentor) throw ApiError.notFound('Active student or mentor not found.');
  const m = await Mentorship.findOneAndUpdate(
    { student: student._id, mentor: mentor._id },
    { $set: { status: 'active', assignedBy: req.user._id, respondedAt: new Date() } },
    { upsert: true, new: true },
  );
  await getOrCreateDirect(mentor, student._id).catch(() => {});
  notify(student._id, { type: 'mentorship', title: `${mentor.name} is now your mentor`, body: 'Say hello in Connect!', link: '/app/connect' });
  notify(mentor._id, { type: 'mentorship', title: `New mentee assigned: ${student.name}`, body: 'An admin assigned a student to you.', link: '/mentor/students' });
  audit(req, 'mentorship.assign', { targetType: 'mentorship', targetId: m._id });
  res.json({ success: true, data: m, message: `${student.name} assigned to ${mentor.name}.` });
}

// ---------------------------------------------------------------- mentors & admins
export async function listMentors(req, res) {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 25 });
  const filter = { role: ROLES.MENTOR };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { 'mentorProfile.company': rx }, { 'mentorProfile.expertise': rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).select('name email phone status emailVerified mentorProfile bio links.linkedin lastActiveAt createdAt').sort({ status: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const loads = await Mentorship.aggregate([
    { $match: { mentor: { $in: items.map((i) => i._id) }, status: 'active' } },
    { $group: { _id: '$mentor', n: { $sum: 1 } } },
  ]);
  const loadBy = new Map(loads.map((l) => [String(l._id), l.n]));
  res.json({ success: true, data: paginated(items.map((m) => ({ ...m, mentees: loadBy.get(String(m._id)) || 0 })), total, { page, limit }) });
}

async function inviteStaff(req, data, role) {
  if (await User.exists({ email: data.email })) throw ApiError.conflict('An account with this email already exists.');
  const user = await User.create({
    ...data,
    role,
    status: USER_STATUS.PENDING,
    createdBy: req.user._id,
    unsubscribeToken: randomToken(24),
    ...(role === ROLES.MENTOR ? { mentorProfile: { ...data.mentorProfile, approvedAt: new Date(), approvedBy: req.user._id } } : {}),
  });
  const token = await createOneTimeToken(user._id, 'invite');
  const inviteLink = `${env.CLIENT_URL}/accept-invite/${token}`;
  await sendEmail(user.email, 'mentorInvite', { name: user.name, url: inviteLink, invitedBy: req.user.name, role });
  audit(req, `${role}.invite`, { targetType: 'user', targetId: user._id });
  return { user, inviteLink };
}

export async function createMentor(req, res) {
  const { linkedin, ...rest } = req.body;
  const { user, inviteLink } = await inviteStaff(req, { ...rest, links: { linkedin: linkedin || '' } }, ROLES.MENTOR);
  res.status(201).json({
    success: true,
    // The link is returned so the admin can share it directly when SMTP is not configured.
    data: { user, inviteLink, emailDelivery: env.smtpConfigured ? 'smtp' : 'dev-file' },
    message: `Mentor added. An invitation was ${env.smtpConfigured ? 'emailed' : 'generated'} for ${user.email}.`,
  });
}

export async function createAdmin(req, res) {
  const { user, inviteLink } = await inviteStaff(req, req.body, ROLES.ADMIN);
  res.status(201).json({ success: true, data: { user, inviteLink }, message: `Admin invitation created for ${user.email}.` });
}

export async function resendInvite(req, res) {
  const user = await User.findOne({ _id: req.params.id, status: USER_STATUS.PENDING, createdBy: { $exists: true } });
  if (!user) throw ApiError.notFound('No pending invitation for this user.');
  const token = await createOneTimeToken(user._id, 'invite');
  const inviteLink = `${env.CLIENT_URL}/accept-invite/${token}`;
  await sendEmail(user.email, 'mentorInvite', { name: user.name, url: inviteLink, invitedBy: req.user.name, role: user.role });
  res.json({ success: true, data: { inviteLink }, message: 'Invitation re-sent.' });
}

export async function approveMentor(req, res) {
  const mentor = await User.findOne({ _id: req.params.id, role: ROLES.MENTOR, status: USER_STATUS.PENDING });
  if (!mentor) throw ApiError.notFound('Pending mentor application not found.');
  if (mentor.createdBy) throw ApiError.badRequest('This mentor was invited — they activate by accepting the invitation.');
  mentor.status = USER_STATUS.ACTIVE;
  mentor.mentorProfile.approvedAt = new Date();
  mentor.mentorProfile.approvedBy = req.user._id;
  await mentor.save({ validateModifiedOnly: true });
  await sendEmail(mentor.email, 'mentorApproved', { name: mentor.name, url: `${env.CLIENT_URL}/login` });
  audit(req, 'mentor.approve', { targetType: 'user', targetId: mentor._id });
  res.json({ success: true, message: `${mentor.name} is now an active mentor.` });
}

export async function rejectMentor(req, res) {
  const mentor = await User.findOne({ _id: req.params.id, role: ROLES.MENTOR, status: USER_STATUS.PENDING });
  if (!mentor) throw ApiError.notFound('Pending mentor application not found.');
  await sendEmail(mentor.email, 'mentorRejected', { name: mentor.name });
  await purgeUser(mentor._id);
  audit(req, 'mentor.reject', { targetType: 'user', targetId: req.params.id, meta: { email: mentor.email } });
  res.json({ success: true, message: 'Application rejected and removed.' });
}

// ---------------------------------------------------------------- settings / announcements
export async function getSettingsCtrl(_req, res) {
  res.json({ success: true, data: await getSettings() });
}

export async function updateSettingsCtrl(req, res) {
  const settings = await updateSettings(req.body, req.user._id);
  audit(req, 'settings.update', { meta: req.body });
  res.json({ success: true, data: settings, message: 'Settings saved.' });
}

export async function announce(req, res) {
  const { title, body, audience, track, sendEmail: withEmail } = req.body;
  const filter = { status: USER_STATUS.ACTIVE };
  if (audience === 'students') filter.role = ROLES.STUDENT;
  else if (audience === 'mentors') filter.role = ROLES.MENTOR;
  else if (audience === 'track') Object.assign(filter, { role: ROLES.STUDENT, careerTracks: track });
  else filter.role = { $in: [ROLES.STUDENT, ROLES.MENTOR] };

  const users = await User.find(filter).select('_id name email consents.marketingEmails +unsubscribeToken').limit(20_000).lean();
  await notify(users.map((u) => u._id), { type: 'announcement', title, body: body.slice(0, 480), link: '' });

  let emailed = 0;
  if (withEmail) {
    // Announcements are optional communications: only users who opted in, each with an unsubscribe link.
    for (const u of users.filter((x) => x.consents?.marketingEmails && x.unsubscribeToken)) {
      await sendEmail(u.email, 'announcement', { name: u.name, title, body, unsubscribeUrl: `${env.CLIENT_URL}/unsubscribe/${u.unsubscribeToken}` });
      emailed += 1;
    }
  }
  audit(req, 'announcement.send', { meta: { title, audience, track, recipients: users.length, emailed } });
  res.json({ success: true, message: `Announcement delivered to ${users.length} users${withEmail ? ` (${emailed} opted-in emails queued)` : ''}.` });
}

// ---------------------------------------------------------------- inbox, requests, logs
export async function auditLogs(req, res) {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 30 });
  const [items, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AuditLog.estimatedDocumentCount(),
  ]);
  res.json({ success: true, data: paginated(items, total, { page, limit }) });
}

export async function contactMessages(req, res) {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20 });
  const filter = req.query.status ? { status: req.query.status } : {};
  const [items, total] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ContactMessage.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginated(items, total, { page, limit }) });
}

export async function updateContactMessage(req, res) {
  const msg = await ContactMessage.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  if (!msg) throw ApiError.notFound('Message not found.');
  res.json({ success: true, data: msg });
}

export async function deletionRequests(req, res) {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20 });
  const filter = req.query.status ? { status: req.query.status } : {};
  const [items, total] = await Promise.all([
    DeletionRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    DeletionRequest.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginated(items, total, { page, limit }) });
}

export async function processDeletion(req, res) {
  const request = await DeletionRequest.findOne({ _id: req.params.id, status: 'pending' });
  if (!request) throw ApiError.notFound('Pending request not found.');
  const purged = request.user ? await purgeUser(request.user) : null;
  request.status = 'completed';
  request.processedBy = req.user._id;
  request.processedAt = new Date();
  await request.save();
  if (purged) sendEmail(purged.email, 'deletionCompleted', { name: purged.name });
  audit(req, 'deletion.process', { targetType: 'deletionRequest', targetId: request._id });
  res.json({ success: true, message: 'Account data deleted.' });
}

export async function emails(req, res) {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 25 });
  const filter = req.query.status ? { status: req.query.status } : {};
  const [items, total] = await Promise.all([
    EmailOutbox.find(filter).select('-html -text').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    EmailOutbox.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginated(items, total, { page, limit }) });
}

export async function retryEmail(req, res) {
  const mail = await EmailOutbox.findOneAndUpdate({ _id: req.params.id, status: 'failed' }, { status: 'queued', attempts: 0, nextAttemptAt: new Date() }, { new: true });
  if (!mail) throw ApiError.notFound('Failed email not found.');
  res.json({ success: true, message: 'Email re-queued.' });
}

// ---------------------------------------------------------------- AI
export async function ai(_req, res) {
  res.json({ success: true, data: await aiStatus() });
}

export async function aiTest(req, res) {
  const result = await testProvider(req.body.provider);
  audit(req, 'ai.test', { meta: { provider: req.body.provider, ok: result.ok } });
  res.json({ success: true, data: result });
}

export async function aiClearCache(req, res) {
  const n = await clearAiCache();
  audit(req, 'ai.cache.clear', { meta: { deleted: n } });
  res.json({ success: true, message: `Cleared ${n} cached AI responses.` });
}

// ---------------------------------------------------------------- AI keys (managed from the portal)
export function aiKeys(_req, res) {
  res.json({ success: true, data: listKeys() });
}
export async function aiKeyAdd(req, res) {
  await addKey(req.body.provider, req.body.key, req.body.label, req.user._id);
  resetPool();
  audit(req, 'ai.key.add', { meta: { provider: req.body.provider, label: req.body.label } }); // the key itself is never logged
  res.status(201).json({ success: true, data: listKeys(), message: 'API key saved (encrypted). Use Test to confirm it works.' });
}
export async function aiKeyRemove(req, res) {
  await removeKey(req.params.provider, req.params.keyId, req.user._id);
  resetPool();
  audit(req, 'ai.key.remove', { meta: { provider: req.params.provider } });
  res.json({ success: true, data: listKeys(), message: 'API key removed.' });
}
export async function aiModelsUpdate(req, res) {
  await setModels(req.body, req.user._id);
  audit(req, 'ai.models.update', { meta: req.body });
  res.json({ success: true, data: listKeys(), message: 'Models updated.' });
}

// ---------------------------------------------------------------- edit user / add student
const dotted = (obj, prefix = '', out = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) dotted(v, path, out);
    else if (v !== undefined) out[path] = v;
  }
  return out;
};
export async function updateUser(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');
  const body = { ...req.body };
  if (user.role !== ROLES.MENTOR) delete body.mentorProfile;
  if (user.role === ROLES.ADMIN) { delete body.education; delete body.address; }
  await User.updateOne({ _id: user._id }, { $set: dotted(body) }, { runValidators: true });
  audit(req, 'user.update', { targetType: 'user', targetId: user._id, meta: { fields: Object.keys(dotted(body)) } });
  res.json({ success: true, message: 'Details updated.' });
}
export async function createStudent(req, res) {
  const { user, inviteLink } = await inviteStaff(req, { ...req.body, education: { level: 'UG', ...req.body.education } }, ROLES.STUDENT);
  res.status(201).json({ success: true, data: { user, inviteLink, emailDelivery: env.smtpConfigured ? 'smtp' : 'dev-file' }, message: `Student added. An invitation was ${env.smtpConfigured ? 'emailed' : 'generated'} for ${user.email}.` });
}
