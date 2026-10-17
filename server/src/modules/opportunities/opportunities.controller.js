import { z } from 'zod';
import { Opportunity, Application, User, Roadmap } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { escapeRegex, getPagination, paginated } from '../../utils/helpers.js';
import { objectId, text, optionalUrl, pagination } from '../../utils/schemas.js';
import { OPPORTUNITY_SOURCES, OPPORTUNITY_TYPES, APPLICATION_STATUSES, ROLES, USER_STATUS } from '../../config/constants.js';
import { notify } from '../../services/notification.service.js';
import { refreshReadiness } from '../../services/readiness.service.js';
import { getSettings } from '../../services/settings.service.js';
import { externalSearchLinks } from '../../data/careerData.js';
import { audit } from '../../services/audit.service.js';

export const idSchema = z.object({ id: objectId });

export const listQuery = z.object({
  ...pagination,
  q: text(100).optional(),
  type: z.enum(OPPORTUNITY_TYPES).optional(),
  source: z.enum(OPPORTUNITY_SOURCES).optional(),
  track: text(80).optional(),
  forMe: z.enum(['true', 'false']).optional(),
});

function baseFilter(query) {
  const filter = {};
  if (query.type) filter.type = query.type;
  if (query.source) filter.source = query.source;
  if (query.track) filter.tracks = query.track;
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ title: rx }, { organization: rx }, { location: rx }];
  }
  return filter;
}

/** Student-facing feed: active, not past deadline; optionally matched to their tracks. */
export async function list(req, res) {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 12 });
  const filter = {
    ...baseFilter(req.query),
    status: 'active',
    $and: [{ $or: [{ deadline: null }, { deadline: { $gte: new Date() } }] }],
  };
  if (req.query.forMe === 'true' && req.user.careerTracks?.length) {
    filter.$and.push({ $or: [{ tracks: { $in: req.user.careerTracks } }, { tracks: { $size: 0 } }] });
  }
  const [items, total, apps] = await Promise.all([
    Opportunity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('postedBy', 'name role').lean(),
    Opportunity.countDocuments(filter),
    Application.find({ user: req.user._id }).select('opportunity status').lean(),
  ]);
  const statusById = new Map(apps.map((a) => [String(a.opportunity), a.status]));
  res.json({ success: true, data: paginated(items.map((o) => ({ ...o, myStatus: statusById.get(String(o._id)) || null })), total, { page, limit }) });
}

/** Staff management list: mentors see their own, admins see all — with engagement counts. */
export async function manageList(req, res) {
  const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20 });
  const filter = baseFilter(req.query);
  if (req.user.role === ROLES.MENTOR) filter.postedBy = req.user._id;
  const [items, total] = await Promise.all([
    Opportunity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('postedBy', 'name role').lean(),
    Opportunity.countDocuments(filter),
  ]);
  const counts = await Application.aggregate([
    { $match: { opportunity: { $in: items.map((i) => i._id) } } },
    { $group: { _id: { o: '$opportunity', s: '$status' }, n: { $sum: 1 } } },
  ]);
  const stats = {};
  for (const c of counts) (stats[String(c._id.o)] ||= {})[c._id.s] = c.n;
  res.json({ success: true, data: paginated(items.map((o) => ({ ...o, stats: stats[String(o._id)] || {} })), total, { page, limit }) });
}

export async function getOne(req, res) {
  const opp = await Opportunity.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }, { new: true }).populate('postedBy', 'name role').lean();
  if (!opp || (opp.status !== 'active' && req.user.role === ROLES.STUDENT)) throw ApiError.notFound('Opportunity not found.');
  const application = await Application.findOne({ user: req.user._id, opportunity: opp._id }).lean();
  res.json({ success: true, data: { ...opp, application } });
}

export const bodySchema = z.object({
  title: text(140, 3),
  organization: text(120, 2),
  type: z.enum(OPPORTUNITY_TYPES),
  source: z.enum(OPPORTUNITY_SOURCES).default('other'),
  url: optionalUrl.default(''),
  description: text(3000).default(''),
  location: text(120).default(''),
  mode: z.enum(['remote', 'onsite', 'hybrid']).default('remote'),
  compensation: text(80).default(''),
  eligibility: text(400).default(''),
  tracks: z.array(text(80)).max(10).default([]),
  deadline: z.coerce.date().optional().nullable(),
  status: z.enum(['active', 'closed', 'draft']).default('active'),
  notifyStudents: z.boolean().optional().default(true),
});

export async function create(req, res) {
  const { notifyStudents, ...data } = req.body;
  if (data.deadline && data.deadline < new Date()) throw ApiError.badRequest('Deadline must be in the future.', [{ field: 'deadline', message: 'Must be a future date' }]);
  const opp = await Opportunity.create({ ...data, postedBy: req.user._id, postedByRole: req.user.role });

  if (notifyStudents && opp.status === 'active') {
    const filter = { role: ROLES.STUDENT, status: USER_STATUS.ACTIVE };
    if (opp.tracks.length) filter.careerTracks = { $in: opp.tracks };
    const students = await User.find(filter).select('_id').limit(5000).lean();
    notify(
      students.map((s) => s._id),
      { type: 'opportunity', title: `New ${opp.type}: ${opp.title}`, body: `${opp.organization}${opp.deadline ? ` · Apply by ${opp.deadline.toDateString()}` : ''}`, link: '/app/opportunities' },
    );
  }
  audit(req, 'opportunity.create', { targetType: 'opportunity', targetId: opp._id });
  res.status(201).json({ success: true, data: opp, message: 'Opportunity published.' });
}

async function loadOwned(req) {
  const opp = await Opportunity.findById(req.params.id);
  if (!opp) throw ApiError.notFound('Opportunity not found.');
  if (req.user.role !== ROLES.ADMIN && String(opp.postedBy) !== String(req.user._id)) throw ApiError.forbidden('You can only edit opportunities you posted.');
  return opp;
}

export async function update(req, res) {
  const opp = await loadOwned(req);
  const { notifyStudents, ...data } = req.body;
  Object.assign(opp, data);
  await opp.save();
  audit(req, 'opportunity.update', { targetType: 'opportunity', targetId: opp._id });
  res.json({ success: true, data: opp, message: 'Opportunity updated.' });
}

export async function remove(req, res) {
  const opp = await loadOwned(req);
  await Promise.all([opp.deleteOne(), Application.deleteMany({ opportunity: opp._id })]);
  audit(req, 'opportunity.delete', { targetType: 'opportunity', targetId: opp._id, meta: { title: opp.title } });
  res.json({ success: true, message: 'Opportunity deleted.' });
}

// ---------------------------------------------------------------- application tracker
export const applicationSchema = z.object({
  status: z.enum(APPLICATION_STATUSES),
  notes: text(1000).optional().default(''),
});

export async function upsertApplication(req, res) {
  const opp = await Opportunity.exists({ _id: req.params.id });
  if (!opp) throw ApiError.notFound('Opportunity not found.');
  const app = await Application.findOneAndUpdate(
    { user: req.user._id, opportunity: req.params.id },
    { $set: { status: req.body.status, notes: req.body.notes } },
    { upsert: true, new: true, runValidators: true },
  );
  refreshReadiness(req.user._id);
  res.json({ success: true, data: app, message: 'Tracker updated.' });
}

export async function removeApplication(req, res) {
  await Application.deleteOne({ user: req.user._id, opportunity: req.params.id });
  refreshReadiness(req.user._id);
  res.json({ success: true, message: 'Removed from your tracker.' });
}

export async function myApplications(req, res) {
  const items = await Application.find({ user: req.user._id })
    .sort({ updatedAt: -1 })
    .populate('opportunity', 'title organization type deadline url source status')
    .lean();
  res.json({ success: true, data: items.filter((a) => a.opportunity) });
}

/** Deep links to external platforms, personalised with the student's tracks. */
export async function external(req, res) {
  const settings = await getSettings();
  const tracks = req.user.careerTracks?.length ? req.user.careerTracks : [];
  const titles = tracks.length
    ? (await Roadmap.find({ slug: { $in: tracks } }).select('slug title roles').lean())
    : [];
  const queries = titles.length
    ? titles.map((t) => ({ track: t.title, query: t.roles?.[0] || t.title }))
    : [{ track: 'General', query: 'fresher' }];

  // Ordered as a student's journey: learn → train → intern → get hired.
  const labels = { skillnexgen: 'Skill NexGen', kaushalsaathi: 'KaushalSaathi', internsaathi: 'InternSaathi', naukrisaathi: 'NaukriSaathi' };
  const descriptions = {
    skillnexgen: 'Industry-focused courses with projects, certificates and mentors',
    kaushalsaathi: 'Live, mentor-led job-ready training with real projects',
    internsaathi: 'Internships across the Skill NexGen network',
    naukrisaathi: 'Jobs for freshers and graduates with verified companies',
  };
  res.json({
    success: true,
    data: {
      ecosystem: Object.entries(labels).map(([key, label]) => ({
        key,
        label,
        description: descriptions[key],
        url: settings.ecosystemLinks?.[key] || '',
      })),
      searches: queries.map(({ track, query }) => ({ track, query, links: externalSearchLinks(query) })),
    },
  });
}
