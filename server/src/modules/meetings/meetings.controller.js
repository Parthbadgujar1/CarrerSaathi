import crypto from 'node:crypto';
import { z } from 'zod';
import { Meeting, Mentorship, User } from '../../models/index.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { getPagination, paginated } from '../../utils/helpers.js';
import { objectId, text, optionalUrl, pagination } from '../../utils/schemas.js';
import { MEETING_TYPES, ROLES, USER_STATUS } from '../../config/constants.js';
import { notify } from '../../services/notification.service.js';
import { audit } from '../../services/audit.service.js';
import { meetingVisibilityFilter, joinWindow } from './meetings.service.js';

export const idSchema = z.object({ id: objectId });

export const listQuery = z.object({
  ...pagination,
  when: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
  hosted: z.enum(['true', 'false']).optional(),
});

export async function list(req, res) {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20 });
  const visibility = req.query.hosted === 'true' ? { host: req.user._id } : await meetingVisibilityFilter(req.user);
  const now = new Date();
  const filter = { ...visibility };
  if (req.query.when === 'upcoming') {
    filter.status = 'scheduled';
    filter.startAt = { $gte: new Date(now.getTime() - 3 * 3600_000) };
  } else if (req.query.when === 'past') {
    filter.startAt = { $lt: now };
  }
  const sort = req.query.when === 'past' ? { startAt: -1 } : { startAt: 1 };
  const [items, total] = await Promise.all([
    Meeting.find(filter).sort(sort).skip(skip).limit(limit).populate('host', 'name role').lean(),
    Meeting.countDocuments(filter),
  ]);
  const uid = String(req.user._id);
  res.json({
    success: true,
    data: paginated(
      items.map((m) => ({
        ...m,
        attendeeCount: m.attendees.length,
        attending: m.attendees.some((a) => String(a) === uid),
        attendees: undefined,
        ...joinWindow(m),
      })),
      total,
      { page, limit },
    ),
  });
}

export async function getOne(req, res) {
  const visibility = await meetingVisibilityFilter(req.user);
  const meeting = await Meeting.findOne({ _id: req.params.id, ...visibility }).populate('host', 'name role').lean();
  if (!meeting) throw ApiError.notFound('Session not found or not available to you.');
  const win = joinWindow(meeting);
  const isHost = String(meeting.host._id) === String(req.user._id) || req.user.role === ROLES.ADMIN;
  res.json({
    success: true,
    data: {
      ...meeting,
      attendeeCount: meeting.attendees.length,
      attending: meeting.attendees.some((a) => String(a) === String(req.user._id)),
      attendees: undefined,
      ...win,
      isHost,
      // Room details are only released inside the join window (or to the host).
      join:
        meeting.status === 'scheduled' && (win.canJoin || isHost)
          ? meeting.mode === 'external'
            ? { type: 'external', url: meeting.externalUrl }
            : { type: 'jitsi', domain: env.JITSI_DOMAIN, room: meeting.roomName }
          : null,
    },
  });
}

export const bodySchema = z
  .object({
    title: text(140, 3),
    description: text(2000).default(''),
    type: z.enum(MEETING_TYPES).default('seminar'),
    startAt: z.coerce.date(),
    durationMinutes: z.coerce.number().int().min(10).max(480).default(60),
    audience: z.object({
      type: z.enum(['all', 'students', 'mentors', 'tracks', 'mentees', 'users']),
      tracks: z.array(text(80)).max(10).default([]),
      users: z.array(objectId).max(500).default([]),
    }),
    mode: z.enum(['in-portal', 'external']).default('in-portal'),
    externalUrl: optionalUrl.default(''),
    capacity: z.coerce.number().int().min(1).max(10000).default(500),
  })
  .refine((d) => d.mode !== 'external' || d.externalUrl, { message: 'Add the meeting link for external sessions', path: ['externalUrl'] })
  .refine((d) => d.audience.type !== 'tracks' || d.audience.tracks.length, { message: 'Choose at least one career track', path: ['audience', 'tracks'] })
  .refine((d) => d.audience.type !== 'users' || d.audience.users.length, { message: 'Choose at least one person', path: ['audience', 'users'] });

/** Users who should be notified about a meeting. */
async function audienceUserIds(meeting) {
  const a = meeting.audience;
  const active = { status: USER_STATUS.ACTIVE };
  let filter;
  switch (a.type) {
    case 'all':
      filter = { ...active, role: { $in: [ROLES.STUDENT, ROLES.MENTOR] } };
      break;
    case 'students':
      filter = { ...active, role: ROLES.STUDENT };
      break;
    case 'mentors':
      filter = { ...active, role: ROLES.MENTOR };
      break;
    case 'tracks':
      filter = { ...active, role: ROLES.STUDENT, careerTracks: { $in: a.tracks } };
      break;
    case 'mentees': {
      const ms = await Mentorship.find({ mentor: meeting.host, status: 'active' }).select('student').lean();
      return ms.map((m) => m.student);
    }
    case 'users':
      return a.users;
    default:
      return [];
  }
  const users = await User.find(filter).select('_id').limit(5000).lean();
  return users.map((u) => u._id);
}

export async function create(req, res) {
  if (req.body.startAt < new Date(Date.now() - 5 * 60_000)) {
    throw ApiError.badRequest('Start time must be in the future.', [{ field: 'startAt', message: 'Choose a future time' }]);
  }
  if (req.user.role === ROLES.MENTOR && ['all', 'mentors'].includes(req.body.audience.type)) {
    throw ApiError.forbidden('Mentors can schedule sessions for students, career tracks, their mentees or selected people.');
  }
  const meeting = await Meeting.create({
    ...req.body,
    host: req.user._id,
    hostRole: req.user.role,
    roomName: `CareerSaathi-${crypto.randomBytes(9).toString('base64url')}`,
  });
  const ids = (await audienceUserIds(meeting)).filter((id) => String(id) !== String(req.user._id));
  notify(ids, {
    type: 'meeting',
    title: `New session: ${meeting.title}`,
    body: `${meeting.startAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST · ${meeting.durationMinutes} min`,
    link: `/meet/${meeting._id}`,
  });
  audit(req, 'meeting.create', { targetType: 'meeting', targetId: meeting._id });
  res.status(201).json({ success: true, data: meeting, message: `Session scheduled and ${ids.length} people notified.` });
}

async function loadHosted(req) {
  const meeting = await Meeting.findById(req.params.id);
  if (!meeting) throw ApiError.notFound('Session not found.');
  if (req.user.role !== ROLES.ADMIN && String(meeting.host) !== String(req.user._id)) throw ApiError.forbidden('Only the host can change this session.');
  return meeting;
}

export async function update(req, res) {
  const meeting = await loadHosted(req);
  Object.assign(meeting, req.body);
  meeting.reminderSent = false;
  await meeting.save();
  notify(meeting.attendees, { type: 'meeting', title: `Session updated: ${meeting.title}`, body: 'Time or details changed — please check.', link: `/meet/${meeting._id}` });
  res.json({ success: true, data: meeting, message: 'Session updated.' });
}

export async function cancel(req, res) {
  const meeting = await loadHosted(req);
  meeting.status = 'cancelled';
  await meeting.save();
  notify(meeting.attendees, { type: 'meeting', title: `Session cancelled: ${meeting.title}`, body: 'The host has cancelled this session.', link: '/app/opportunities?tab=sessions' });
  audit(req, 'meeting.cancel', { targetType: 'meeting', targetId: meeting._id });
  res.json({ success: true, message: 'Session cancelled and attendees notified.' });
}

export async function rsvp(req, res) {
  const visibility = await meetingVisibilityFilter(req.user);
  const meeting = await Meeting.findOne({ _id: req.params.id, ...visibility, status: 'scheduled' });
  if (!meeting) throw ApiError.notFound('Session not found.');
  const attending = req.body.attending !== false;
  if (attending && meeting.attendees.length >= meeting.capacity) throw ApiError.conflict('This session is full.');
  await Meeting.updateOne({ _id: meeting._id }, attending ? { $addToSet: { attendees: req.user._id } } : { $pull: { attendees: req.user._id } });
  res.json({ success: true, data: { attending }, message: attending ? "You're registered. We'll remind you before it starts." : 'Registration cancelled.' });
}

export const rsvpSchema = z.object({ attending: z.boolean().default(true) });
