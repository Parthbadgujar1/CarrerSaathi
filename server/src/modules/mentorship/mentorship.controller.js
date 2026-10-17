import { z } from 'zod';
import { User, Mentorship, MentorNote, Enrollment, Application, WellnessLog } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { escapeRegex, getPagination, paginated, dayKey, addDays } from '../../utils/helpers.js';
import { objectId, text, pagination } from '../../utils/schemas.js';
import { ROLES, USER_STATUS } from '../../config/constants.js';
import { notify } from '../../services/notification.service.js';
import { computeReadiness } from '../../services/readiness.service.js';
import { getOrCreateDirect } from '../chat/chat.service.js';

export const idSchema = z.object({ id: objectId });
const MAX_ACTIVE_MENTORS = 3;
const MAX_PENDING = 3;

// ---------------------------------------------------------------- mentor directory (students)
export const directoryQuery = z.object({ ...pagination, q: text(80).optional(), expertise: text(60).optional() });

export async function directory(req, res) {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 12 });
  const filter = { role: ROLES.MENTOR, status: USER_STATUS.ACTIVE };
  if (req.query.expertise) filter['mentorProfile.expertise'] = new RegExp(escapeRegex(req.query.expertise), 'i');
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { 'mentorProfile.company': rx }, { 'mentorProfile.designation': rx }, { 'mentorProfile.expertise': rx }];
  }
  const [mentors, total] = await Promise.all([
    User.find(filter).select('name headline bio mentorProfile links.linkedin lastActiveAt').sort({ 'mentorProfile.experienceYears': -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const ids = mentors.map((m) => m._id);
  const [loads, mine] = await Promise.all([
    Mentorship.aggregate([{ $match: { mentor: { $in: ids }, status: 'active' } }, { $group: { _id: '$mentor', n: { $sum: 1 } } }]),
    Mentorship.find({ student: req.user._id, mentor: { $in: ids } }).select('mentor status').lean(),
  ]);
  const loadBy = new Map(loads.map((l) => [String(l._id), l.n]));
  const mineBy = new Map(mine.map((m) => [String(m.mentor), m.status]));
  res.json({
    success: true,
    data: paginated(
      mentors.map((m) => {
        const mentees = loadBy.get(String(m._id)) || 0;
        return { ...m, mentees, isFull: mentees >= (m.mentorProfile?.maxMentees || 25), myStatus: mineBy.get(String(m._id)) || null };
      }),
      total,
      { page, limit },
    ),
  });
}

// ---------------------------------------------------------------- requests
export const requestSchema = z.object({ mentorId: objectId, message: text(500).optional().default('') });

export async function requestMentor(req, res) {
  const mentor = await User.findOne({ _id: req.body.mentorId, role: ROLES.MENTOR, status: USER_STATUS.ACTIVE }).lean();
  if (!mentor) throw ApiError.notFound('Mentor not found.');
  const [active, pending, existing, load] = await Promise.all([
    Mentorship.countDocuments({ student: req.user._id, status: 'active' }),
    Mentorship.countDocuments({ student: req.user._id, status: 'pending' }),
    Mentorship.findOne({ student: req.user._id, mentor: mentor._id }),
    Mentorship.countDocuments({ mentor: mentor._id, status: 'active' }),
  ]);
  if (existing && ['pending', 'active'].includes(existing.status)) throw ApiError.conflict('You already have a request or mentorship with this mentor.');
  if (active >= MAX_ACTIVE_MENTORS) throw ApiError.badRequest(`You can have up to ${MAX_ACTIVE_MENTORS} mentors at a time.`);
  if (pending >= MAX_PENDING) throw ApiError.badRequest('You have several pending requests. Please wait for responses first.');
  if (load >= (mentor.mentorProfile?.maxMentees || 25)) throw ApiError.badRequest('This mentor is not accepting new mentees right now.');

  const doc = existing
    ? Object.assign(existing, { status: 'pending', requestMessage: req.body.message, respondedAt: undefined })
    : new Mentorship({ student: req.user._id, mentor: mentor._id, requestMessage: req.body.message });
  await doc.save();
  notify(mentor._id, { type: 'mentorship', title: 'New mentorship request', body: `${req.user.name} would like you to mentor them.`, link: '/mentor' });
  res.status(201).json({ success: true, data: doc, message: 'Request sent! You will be notified when the mentor responds.' });
}

export async function mine(req, res) {
  const isMentor = req.user.role === ROLES.MENTOR;
  const filter = isMentor ? { mentor: req.user._id } : { student: req.user._id };
  const items = await Mentorship.find({ ...filter, status: { $in: ['pending', 'active'] } })
    .sort({ updatedAt: -1 })
    .populate(
      isMentor ? 'student' : 'mentor',
      isMentor ? 'name education.college education.degree education.branch careerTracks readinessScore lastActiveAt' : 'name headline mentorProfile links.linkedin lastActiveAt',
    )
    .lean();
  res.json({ success: true, data: items.filter((m) => (isMentor ? m.student : m.mentor)) });
}

export const respondSchema = z.object({ accept: z.boolean() });

export async function respond(req, res) {
  const m = await Mentorship.findOne({ _id: req.params.id, mentor: req.user._id, status: 'pending' });
  if (!m) throw ApiError.notFound('Request not found.');
  m.status = req.body.accept ? 'active' : 'declined';
  m.respondedAt = new Date();
  await m.save();
  if (req.body.accept) await getOrCreateDirect(req.user, m.student);
  notify(m.student, {
    type: 'mentorship',
    title: req.body.accept ? `${req.user.name} accepted your mentorship request 🎉` : 'Mentorship request update',
    body: req.body.accept ? 'You can now chat with your mentor in Connect.' : `${req.user.name} is unable to take new mentees right now. Try another mentor.`,
    link: '/app/connect',
  });
  res.json({ success: true, data: m, message: req.body.accept ? 'Request accepted.' : 'Request declined.' });
}

export async function end(req, res) {
  const m = await Mentorship.findOne({ _id: req.params.id, status: { $in: ['active', 'pending'] }, $or: [{ student: req.user._id }, { mentor: req.user._id }] });
  if (!m) throw ApiError.notFound('Mentorship not found.');
  m.status = 'ended';
  await m.save();
  const other = String(m.student) === String(req.user._id) ? m.mentor : m.student;
  notify(other, { type: 'mentorship', title: 'Mentorship ended', body: `${req.user.name} ended the mentorship.`, link: '/' });
  res.json({ success: true, message: 'Mentorship ended.' });
}

// ---------------------------------------------------------------- mentor: student tracking
export const studentsQuery = z.object({
  ...pagination,
  scope: z.enum(['mine', 'all']).default('mine'),
  q: text(80).optional(),
  track: text(80).optional(),
});

export async function students(req, res) {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20 });
  const myLinks = await Mentorship.find({ mentor: req.user._id, status: 'active' }).select('student').lean();
  const myIds = myLinks.map((m) => m.student);
  const filter = { role: ROLES.STUDENT, status: USER_STATUS.ACTIVE };
  if (req.query.scope === 'mine') filter._id = { $in: myIds };
  if (req.query.track) filter.careerTracks = req.query.track;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ name: rx }, { 'education.college': rx }, { 'education.degree': rx }];
  }
  // Mentors get a privacy-reduced view: no phone, address or email.
  const [items, total] = await Promise.all([
    User.find(filter)
      .select('name education.college education.degree education.branch education.graduationYear careerTracks readinessScore lastActiveAt createdAt')
      .sort({ lastActiveAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  const mine = new Set(myIds.map(String));
  res.json({ success: true, data: paginated(items.map((s) => ({ ...s, isMyMentee: mine.has(String(s._id)) })), total, { page, limit }) });
}

export async function studentDetail(req, res) {
  const student = await User.findOne({ _id: req.params.id, role: ROLES.STUDENT })
    .select('name headline bio education careerTracks skills links readinessScore lastActiveAt createdAt consents.wellnessShareWithMentor')
    .lean();
  if (!student) throw ApiError.notFound('Student not found.');
  const isMentee = await Mentorship.exists({ mentor: req.user._id, student: student._id, status: 'active' });

  const [enrollments, readiness, appCounts, notes] = await Promise.all([
    Enrollment.find({ user: student._id }).populate('roadmap', 'title slug').select('progress status lastActivityAt roadmap').lean(),
    computeReadiness(student._id),
    Application.aggregate([{ $match: { user: student._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    MentorNote.find({ student: student._id, mentor: req.user._id }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);

  let wellness = null;
  if (isMentee && student.consents?.wellnessShareWithMentor) {
    const logs = await WellnessLog.find({ user: student._id, day: { $gte: dayKey(addDays(new Date(), -13)) } })
      .select('day mood stress sleepHours')
      .sort({ day: 1 })
      .lean();
    const avg = (k) => (logs.length ? +(logs.reduce((s, l) => s + (l[k] || 0), 0) / logs.length).toFixed(1) : null);
    wellness = { days: logs.length, avgMood: avg('mood'), avgStress: avg('stress'), avgSleep: avg('sleepHours'), logs };
  }

  res.json({
    success: true,
    data: {
      student: { ...student, links: isMentee ? student.links : undefined },
      isMentee: Boolean(isMentee),
      enrollments: enrollments.filter((e) => e.roadmap),
      readiness: { score: readiness.score, breakdown: readiness.breakdown, kit: readiness.kit },
      applications: Object.fromEntries(appCounts.map((a) => [a._id, a.n])),
      wellness,
      wellnessShared: Boolean(student.consents?.wellnessShareWithMentor),
      notes,
    },
  });
}

export const noteSchema = z.object({
  type: z.enum(['note', 'goal', 'feedback']).default('note'),
  text: text(2000, 2),
  visibleToStudent: z.boolean().default(true),
});

export async function addNote(req, res) {
  const isMentee = await Mentorship.exists({ mentor: req.user._id, student: req.params.id, status: 'active' });
  if (!isMentee) throw ApiError.forbidden('You can add notes only for your mentees.');
  const note = await MentorNote.create({ ...req.body, mentor: req.user._id, student: req.params.id });
  if (note.visibleToStudent) {
    notify(req.params.id, { type: 'mentor_note', title: `${req.user.name} added a ${note.type}`, body: note.text.slice(0, 120), link: '/app' });
  }
  res.status(201).json({ success: true, data: note, message: 'Saved.' });
}

export const noteUpdateSchema = z.object({ done: z.boolean().optional(), text: text(2000, 2).optional(), visibleToStudent: z.boolean().optional() });

export async function updateNote(req, res) {
  const filter = { _id: req.params.id };
  // Students may only tick their own goals as done; mentors may edit their notes.
  if (req.user.role === ROLES.STUDENT) {
    filter.student = req.user._id;
    filter.type = 'goal';
    req.body = { done: req.body.done };
  } else filter.mentor = req.user._id;
  const note = await MentorNote.findOneAndUpdate(filter, { $set: req.body }, { new: true });
  if (!note) throw ApiError.notFound('Note not found.');
  res.json({ success: true, data: note });
}

export async function deleteNote(req, res) {
  const note = await MentorNote.findOneAndDelete({ _id: req.params.id, mentor: req.user._id });
  if (!note) throw ApiError.notFound('Note not found.');
  res.json({ success: true, message: 'Note deleted.' });
}
