import { z } from 'zod';
import crypto from 'node:crypto';
import { Roadmap, Enrollment, User } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { escapeRegex, slugify } from '../../utils/helpers.js';
import { objectId, text } from '../../utils/schemas.js';
import { ROADMAP_CATEGORIES, ROLES } from '../../config/constants.js';
import { refreshReadiness } from '../../services/readiness.service.js';
import { generateRoadmap, loadDraft } from '../../services/ai/ai.service.js';
import { scoreQuiz } from '../../services/ai/fallback.js';
import { QUIZ } from '../../data/careerData.js';
import { audit } from '../../services/audit.service.js';

const LIST_FIELDS = 'slug title category summary icon duration roles skills source updatedAt phases.steps.key';

const withCounts = (r) => ({
  ...r,
  totalSteps: (r.phases || []).reduce((n, p) => n + (p.steps?.length || 0), 0),
  phases: undefined,
});

// ---------------------------------------------------------------- library
export const listQuery = z.object({
  q: text(100).optional(),
  category: z.enum(ROADMAP_CATEGORIES).optional(),
});

export async function list(req, res) {
  const filter = { isPublished: true, owner: null };
  if (req.query.category) filter.category = req.query.category;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(req.query.q), 'i');
    filter.$or = [{ title: rx }, { keywords: rx }, { roles: rx }, { skills: rx }];
  }
  const items = await Roadmap.find(filter).select(LIST_FIELDS).sort({ category: 1, title: 1 }).lean();
  res.json({ success: true, data: items.map(withCounts) });
}

/** Public or owned roadmap by slug or id. Students also get their progress + skill gap. */
export async function getOne(req, res) {
  const key = req.params.slug;
  const filter = /^[a-f\d]{24}$/i.test(key) ? { _id: key } : { slug: key };
  const roadmap = await Roadmap.findOne(filter).lean();
  const isOwner = roadmap?.owner && req.user && String(roadmap.owner) === String(req.user._id);
  const isStaff = req.user && [ROLES.ADMIN].includes(req.user.role);
  if (!roadmap || (!roadmap.isPublished && !isOwner && !isStaff)) throw ApiError.notFound('Roadmap not found.');

  let enrollment = null;
  let skillGap = null;
  if (req.user) {
    enrollment = await Enrollment.findOne({ user: req.user._id, roadmap: roadmap._id }).lean();
    const mine = new Set((req.user.skills || []).map((s) => s.toLowerCase()));
    const skills = roadmap.skills || [];
    skillGap = {
      have: skills.filter((s) => mine.has(s.toLowerCase())),
      missing: skills.filter((s) => !mine.has(s.toLowerCase())),
    };
  }
  res.json({ success: true, data: { roadmap, enrollment, skillGap } });
}

// ---------------------------------------------------------------- enrollment
export async function myEnrollments(req, res) {
  const items = await Enrollment.find({ user: req.user._id })
    .populate('roadmap', LIST_FIELDS)
    .sort({ lastActivityAt: -1 })
    .lean();
  res.json({
    success: true,
    data: items.filter((e) => e.roadmap).map((e) => ({ ...e, roadmap: withCounts(e.roadmap) })),
  });
}

async function enrollUser(userId, roadmap) {
  const enrollment = await Enrollment.findOneAndUpdate(
    { user: userId, roadmap: roadmap._id },
    { $setOnInsert: { user: userId, roadmap: roadmap._id, completed: [], progress: 0, status: 'active' } },
    { upsert: true, new: true },
  );
  // Enrolling also records the career track on the profile (used for matching opportunities).
  if (roadmap.slug && !roadmap.owner) {
    await User.updateOne({ _id: userId, 'careerTracks.4': { $exists: false } }, { $addToSet: { careerTracks: roadmap.slug } });
  }
  refreshReadiness(userId);
  return enrollment;
}

export async function enroll(req, res) {
  const roadmap = await Roadmap.findById(req.params.id).lean();
  if (!roadmap || (!roadmap.isPublished && String(roadmap.owner) !== String(req.user._id))) throw ApiError.notFound('Roadmap not found.');
  const count = await Enrollment.countDocuments({ user: req.user._id });
  if (count >= 6 && !(await Enrollment.exists({ user: req.user._id, roadmap: roadmap._id }))) {
    throw ApiError.badRequest('You can follow up to 6 roadmaps at a time. Remove one to add another.');
  }
  const enrollment = await enrollUser(req.user._id, roadmap);
  res.status(201).json({ success: true, data: enrollment, message: `Added "${roadmap.title}" to your roadmaps.` });
}

export async function unenroll(req, res) {
  const roadmap = await Roadmap.findById(req.params.id).select('slug owner').lean();
  await Enrollment.deleteOne({ user: req.user._id, roadmap: req.params.id });
  if (roadmap?.owner && String(roadmap.owner) === String(req.user._id)) await Roadmap.deleteOne({ _id: roadmap._id });
  else if (roadmap?.slug) await User.updateOne({ _id: req.user._id }, { $pull: { careerTracks: roadmap.slug } });
  refreshReadiness(req.user._id);
  res.json({ success: true, message: 'Roadmap removed.' });
}

export const stepSchema = z.object({ key: text(80, 1), done: z.boolean() });

export async function toggleStep(req, res) {
  const enrollment = await Enrollment.findOne({ user: req.user._id, roadmap: req.params.id });
  if (!enrollment) throw ApiError.notFound('You are not following this roadmap.');
  const roadmap = await Roadmap.findById(req.params.id).select('phases').lean();
  const allKeys = roadmap.phases.flatMap((p) => p.steps.map((s) => s.key));
  if (!allKeys.includes(req.body.key)) throw ApiError.badRequest('Unknown step.');

  const without = enrollment.completed.filter((c) => c.key !== req.body.key);
  enrollment.completed = req.body.done ? [...without, { key: req.body.key, at: new Date() }] : without;
  const doneCount = enrollment.completed.filter((c) => allKeys.includes(c.key)).length;
  enrollment.progress = allKeys.length ? Math.round((doneCount / allKeys.length) * 100) : 0;
  enrollment.status = enrollment.progress === 100 ? 'completed' : 'active';
  enrollment.lastActivityAt = new Date();
  await enrollment.save();
  refreshReadiness(req.user._id);
  res.json({ success: true, data: { progress: enrollment.progress, status: enrollment.status, completed: enrollment.completed } });
}

// ---------------------------------------------------------------- recommendation & AI
export async function quiz(_req, res) {
  res.json({ success: true, data: QUIZ.map((q) => ({ id: q.id, question: q.question, options: q.options.map(({ id, label }) => ({ id, label })) })) });
}

export const recommendSchema = z.object({ answers: z.record(z.string().max(20), z.string().max(20)) });

export async function recommend(req, res) {
  const ranked = scoreQuiz(req.body.answers, { degree: `${req.user.education?.degree || ''} ${req.user.education?.branch || ''}` });
  const roadmaps = await Roadmap.find({ slug: { $in: ranked.map((r) => r.slug) }, isPublished: true }).select(LIST_FIELDS).lean();
  const bySlug = new Map(roadmaps.map((r) => [r.slug, withCounts(r)]));
  res.json({
    success: true,
    data: ranked.filter((r) => bySlug.has(r.slug)).map((r) => ({ ...r, roadmap: bySlug.get(r.slug) })),
  });
}

export const generateSchema = z.object({
  fields: z.array(text(80, 2)).min(1, 'Add at least one field').max(4, 'Up to 4 fields'),
  level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  hoursPerWeek: z.coerce.number().int().min(1).max(60).default(10),
  timelineMonths: z.coerce.number().int().min(1).max(36).default(6),
  goal: text(160).optional().default(''),
  forceAI: z.boolean().optional().default(false),
});

export async function generate(req, res) {
  const degree = [req.user.education?.degree, req.user.education?.branch].filter(Boolean).join(' ');
  const result = await generateRoadmap({ ...req.body, degree }, req.user);
  const r = result.roadmap;
  res.json({
    success: true,
    data: {
      source: result.source,
      provider: result.provider,
      notice: result.notice,
      draftKey: result.draftKey,
      libraryRoadmapId: result.libraryRoadmap?._id,
      roadmap: {
        title: r.title,
        slug: r.slug,
        summary: r.summary,
        duration: r.duration,
        category: r.category,
        roles: r.roles,
        skills: r.skills,
        phases: r.phases,
      },
    },
  });
}

export const saveDraftSchema = z.object({ draftKey: z.string().regex(/^(roadmap|blend):v1:[a-f\d]{64}$/) });

export async function saveDraft(req, res) {
  const draft = await loadDraft(req.body.draftKey);
  if (!draft) throw ApiError.notFound('This generated roadmap has expired. Please generate it again.');
  const r = draft.roadmap;
  const roadmap = await Roadmap.create({
    slug: `my-${slugify(r.title).slice(0, 50)}-${crypto.randomBytes(3).toString('hex')}`,
    title: r.title.slice(0, 120),
    category: ROADMAP_CATEGORIES.includes(r.category) ? r.category : 'Technology',
    summary: (r.summary || '').slice(0, 400),
    icon: r.icon || 'Sparkles',
    duration: r.duration || '',
    roles: r.roles || [],
    skills: r.skills || [],
    keywords: r.keywords || [],
    careerKit: r.careerKit || [],
    phases: r.phases,
    source: 'ai',
    aiProvider: draft.provider,
    owner: req.user._id,
    isPublished: false,
    createdBy: req.user._id,
  });
  const enrollment = await enrollUser(req.user._id, roadmap.toObject());
  res.status(201).json({ success: true, data: { roadmap, enrollment }, message: 'Saved to your roadmaps.' });
}

// ---------------------------------------------------------------- admin management
const resourceSchema = z.object({
  title: text(160, 1),
  url: z.string().trim().url().max(400),
  type: z.enum(['course', 'doc', 'video', 'practice', 'book', 'community', 'tool']).default('course'),
  free: z.boolean().default(true),
});
export const roadmapBodySchema = z.object({
  title: text(120, 3),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,100}$/).optional(),
  category: z.enum(ROADMAP_CATEGORIES),
  summary: text(400).default(''),
  description: text(2000).default(''),
  icon: text(40).default('Compass'),
  duration: text(40).default(''),
  suitableFor: z.array(text(60)).max(20).default([]),
  roles: z.array(text(80)).max(20).default([]),
  skills: z.array(text(60)).max(40).default([]),
  keywords: z.array(text(60)).max(40).default([]),
  careerKit: z.array(z.object({ key: z.string().regex(/^[a-zA-Z0-9]{2,40}$/), label: text(160, 3) })).max(10).default([]),
  phases: z
    .array(
      z.object({
        title: text(120, 2),
        duration: text(40).default(''),
        steps: z
          .array(
            z.object({
              key: z.string().trim().regex(/^[a-z0-9-]{2,80}$/i, 'Step key: letters, numbers and hyphens'),
              title: text(160, 2),
              description: text(800).default(''),
              isProject: z.boolean().default(false),
              resources: z.array(resourceSchema).max(6).default([]),
            }),
          )
          .min(1)
          .max(15),
      }),
    )
    .min(1)
    .max(12),
  isPublished: z.boolean().default(true),
});

export async function adminList(req, res) {
  const items = await Roadmap.find({ owner: null }).select(`${LIST_FIELDS} isPublished`).sort({ updatedAt: -1 }).lean();
  const counts = await Enrollment.aggregate([{ $group: { _id: '$roadmap', learners: { $sum: 1 }, avgProgress: { $avg: '$progress' } } }]);
  const byId = new Map(counts.map((c) => [String(c._id), c]));
  res.json({
    success: true,
    data: items.map((r) => ({ ...withCounts(r), learners: byId.get(String(r._id))?.learners || 0, avgProgress: Math.round(byId.get(String(r._id))?.avgProgress || 0) })),
  });
}

export async function adminCreate(req, res) {
  const roadmap = await Roadmap.create({ ...req.body, slug: req.body.slug || slugify(req.body.title), source: 'admin', createdBy: req.user._id });
  audit(req, 'roadmap.create', { targetType: 'roadmap', targetId: roadmap._id });
  res.status(201).json({ success: true, data: roadmap, message: 'Roadmap created.' });
}

export async function adminUpdate(req, res) {
  const roadmap = await Roadmap.findOneAndUpdate({ _id: req.params.id, owner: null }, { $set: req.body }, { new: true, runValidators: true });
  if (!roadmap) throw ApiError.notFound('Roadmap not found.');
  audit(req, 'roadmap.update', { targetType: 'roadmap', targetId: roadmap._id });
  res.json({ success: true, data: roadmap, message: 'Roadmap updated.' });
}

export async function adminDelete(req, res) {
  const roadmap = await Roadmap.findOneAndDelete({ _id: req.params.id, owner: null });
  if (!roadmap) throw ApiError.notFound('Roadmap not found.');
  await Enrollment.deleteMany({ roadmap: roadmap._id });
  audit(req, 'roadmap.delete', { targetType: 'roadmap', targetId: roadmap._id, meta: { title: roadmap.title } });
  res.json({ success: true, message: 'Roadmap deleted.' });
}

export const idSchema = z.object({ id: objectId });

export const bulkSchema = z.object({
  roadmaps: z.array(roadmapBodySchema.partial({ slug: true })).min(1, 'Add at least one roadmap').max(50, 'Up to 50 roadmaps per upload'),
  mode: z.enum(['create', 'upsert']).default('upsert'),
});

/** Bulk import: each roadmap is validated by the client parser; results are reported per item. */
export async function adminBulk(req, res) {
  const results = [];
  for (const [i, item] of req.body.roadmaps.entries()) {
    const slug = item.slug || slugify(item.title);
    try {
      const existing = await Roadmap.findOne({ slug, owner: null });
      if (existing && req.body.mode === 'create') {
        results.push({ index: i, title: item.title, status: 'skipped', message: 'Already exists' });
        continue;
      }
      if (existing) {
        await Roadmap.updateOne({ _id: existing._id }, { $set: { ...item, slug } }, { runValidators: true });
        results.push({ index: i, title: item.title, status: 'updated' });
      } else {
        await Roadmap.create({ ...item, slug, source: 'admin', createdBy: req.user._id });
        results.push({ index: i, title: item.title, status: 'created' });
      }
    } catch (err) {
      results.push({ index: i, title: item.title, status: 'failed', message: err.message });
    }
  }
  audit(req, 'roadmap.bulk', { meta: { count: results.length, created: results.filter((r) => r.status === 'created').length } });
  const ok = results.filter((r) => r.status === 'created' || r.status === 'updated').length;
  res.json({ success: true, data: { results }, message: `${ok} of ${results.length} roadmaps imported.` });
}
