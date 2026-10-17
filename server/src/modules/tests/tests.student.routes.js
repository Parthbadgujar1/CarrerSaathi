import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { aiLimiter } from '../../middleware/rateLimiters.js';
import { Attempt, Enrollment, Practice, Roadmap, Test } from '../../models/index.js';
import { ROLES } from '../../config/constants.js';
import { ApiError } from '../../utils/ApiError.js';
import { objectId } from '../../utils/schemas.js';
import { getSettings } from '../../services/settings.service.js';
import { configuredProviders } from '../../services/ai/keyPool.js';
import { getQuota } from '../../services/ai/ai.service.js';
import { generateQuestions } from '../../services/ai/questions.service.js';
import {
  GRACE_MS, attemptDeadline, finalizeAttempt, matchesAudience, questionOrder, resultFor, studentQuestions, totalMarks, windowState,
} from './tests.service.js';

export const testsRouter = Router();
export const practiceRouter = Router();
testsRouter.use(authenticate, authorize(ROLES.STUDENT));
practiceRouter.use(authenticate, authorize(ROLES.STUDENT));

const idParam = z.object({ id: objectId });
const published = { status: 'published' };

/** Finds a published test visible to this student, or throws 404. */
async function loadVisibleTest(id, user) {
  const test = await Test.findOne({ _id: id, ...published });
  if (!test || !matchesAudience(user, test.audience)) throw ApiError.notFound('Test not found.');
  return test;
}

// =============================================================== assigned tests
testsRouter.get('/', async (req, res) => {
  const tests = await Test.find({ ...published, endAt: { $gte: new Date(Date.now() - 30 * 86_400_000) } }).sort({ startAt: -1 }).lean();
  const mine = tests.filter((t) => matchesAudience(req.user, t.audience));
  const attempts = await Attempt.find({ user: req.user._id, test: { $in: mine.map((t) => t._id) } }).sort({ startedAt: -1 }).lean();
  const now = new Date();
  const items = mine.map((t) => {
    const mineAttempts = attempts.filter((a) => String(a.test) === String(t._id));
    const submitted = mineAttempts.filter((a) => a.status === 'submitted');
    const live = mineAttempts.find((a) => a.status === 'in_progress' && a.deadline > now);
    const best = submitted.sort((a, b) => b.percent - a.percent)[0];
    return {
      _id: t._id,
      title: t.title,
      description: t.description,
      startAt: t.startAt,
      endAt: t.endAt,
      durationMinutes: t.durationMinutes,
      passPercent: t.passPercent,
      maxAttempts: t.maxAttempts,
      questionCount: t.questions.length,
      totalMarks: totalMarks(t),
      state: windowState(t, now),
      attemptsUsed: mineAttempts.filter((a) => a.status === 'submitted' || a.deadline > now).length,
      inProgressAttemptId: live?._id || null,
      best: best ? { attemptId: best._id, percent: best.percent, passed: best.passed } : null,
    };
  });
  const order = { open: 0, upcoming: 1, closed: 2 };
  items.sort((a, b) => order[a.state] - order[b.state] || new Date(a.startAt) - new Date(b.startAt));
  res.json({ success: true, data: items });
});

testsRouter.post('/:id/start', validate({ params: idParam }), async (req, res) => {
  const test = await loadVisibleTest(req.params.id, req.user);
  const now = new Date();
  const state = windowState(test, now);
  if (state === 'upcoming') throw ApiError.forbidden(`This test opens on ${test.startAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.`, 'NOT_STARTED');
  if (state !== 'open') throw ApiError.forbidden('This test is closed.', 'TEST_CLOSED');

  // Resume an unfinished attempt (same questions, same deadline); close stale ones first.
  const open = await Attempt.find({ test: test._id, user: req.user._id, status: 'in_progress' });
  for (const a of open) if (a.deadline.getTime() + GRACE_MS < now.getTime()) await finalizeAttempt(a._id, { auto: true });
  let attempt = await Attempt.findOne({ test: test._id, user: req.user._id, status: 'in_progress', deadline: { $gt: now } });

  if (!attempt) {
    const used = await Attempt.countDocuments({ test: test._id, user: req.user._id });
    if (used >= test.maxAttempts) throw ApiError.conflict(`You have used all ${test.maxAttempts} attempt${test.maxAttempts > 1 ? 's' : ''} for this test.`, 'NO_ATTEMPTS_LEFT');
    attempt = await Attempt.create({ test: test._id, user: req.user._id, deadline: attemptDeadline(test, now), order: questionOrder(test) });
  }
  res.json({ success: true, data: takePayload(test, attempt) });
});

function takePayload(test, attempt) {
  return {
    attempt: { _id: attempt._id, startedAt: attempt.startedAt, deadline: attempt.deadline },
    test: { _id: test._id, title: test.title, instructions: test.instructions, durationMinutes: test.durationMinutes, passPercent: test.passPercent },
    questions: studentQuestions(test, attempt.order),
    answers: Object.fromEntries(attempt.answers.map((a) => [String(a.q), a.choice])),
    serverNow: new Date(),
  };
}

const answersBody = z.object({ answers: z.record(objectId, z.number().int().min(0).max(5).nullable()) });

/** Autosave while taking the test, so a refresh or dropped connection loses nothing. */
testsRouter.put('/attempts/:id/answers', validate({ params: idParam, body: answersBody }), async (req, res) => {
  const attempt = await Attempt.findOne({ _id: req.params.id, user: req.user._id });
  if (!attempt) throw ApiError.notFound('Attempt not found.');
  if (attempt.status === 'submitted') return res.json({ success: true, data: { finished: true } });
  if (Date.now() > attempt.deadline.getTime() + GRACE_MS) {
    await finalizeAttempt(attempt._id, { auto: true });
    return res.json({ success: true, data: { finished: true } });
  }
  const test = await Test.findById(attempt.test).select('questions._id').lean();
  const valid = new Set(test.questions.map((q) => String(q._id)));
  const merged = new Map(attempt.answers.map((a) => [String(a.q), a.choice]));
  for (const [q, c] of Object.entries(req.body.answers)) {
    if (!valid.has(q)) continue;
    if (c === null) merged.delete(q);
    else merged.set(q, c);
  }
  attempt.answers = [...merged].map(([q, choice]) => ({ q, choice }));
  await attempt.save();
  res.json({ success: true, data: { saved: merged.size, deadline: attempt.deadline } });
});

testsRouter.post('/attempts/:id/submit', validate({ params: idParam, body: z.object({ answers: answersBody.shape.answers.optional() }) }), async (req, res) => {
  const attempt = await Attempt.findOne({ _id: req.params.id, user: req.user._id });
  if (!attempt) throw ApiError.notFound('Attempt not found.');
  const done = await finalizeAttempt(attempt._id, { answers: req.body.answers });
  const test = await Test.findById(done.test).lean();
  res.json({ success: true, data: resultFor(done, test), message: 'Test submitted.' });
});

testsRouter.get('/attempts/:id', validate({ params: idParam }), async (req, res) => {
  let attempt = await Attempt.findOne({ _id: req.params.id, user: req.user._id });
  if (!attempt) throw ApiError.notFound('Attempt not found.');
  if (attempt.status === 'in_progress' && Date.now() > attempt.deadline.getTime() + GRACE_MS) attempt = await finalizeAttempt(attempt._id, { auto: true });
  const test = await Test.findById(attempt.test);
  if (attempt.status === 'in_progress') return res.json({ success: true, data: { inProgress: true, ...takePayload(test, attempt) } });
  res.json({ success: true, data: resultFor(attempt, test.toObject()) });
});

testsRouter.get('/results/me', async (req, res) => {
  const attempts = await Attempt.find({ user: req.user._id, status: 'submitted' }).sort({ submittedAt: -1 }).limit(50).populate('test', 'title passPercent').lean();
  res.json({ success: true, data: attempts.filter((a) => a.test).map((a) => ({ _id: a._id, title: a.test.title, percent: a.percent, passed: a.passed, score: a.score, total: a.total, submittedAt: a.submittedAt })) });
});

// =============================================================== self practice
const aiAvailable = async () => (await getSettings()).aiEnabled && configuredProviders().length > 0;

practiceRouter.get('/options', async (req, res) => {
  const enrollments = await Enrollment.find({ user: req.user._id }).populate('roadmap', 'title slug phases').lean();
  res.json({
    success: true,
    data: {
      aiAvailable: await aiAvailable(),
      roadmaps: enrollments
        .filter((e) => e.roadmap)
        .map((e) => ({
          _id: e.roadmap._id,
          title: e.roadmap.title,
          slug: e.roadmap.slug,
          progress: e.progress,
          phases: e.roadmap.phases.map((p, i) => ({ index: i, title: p.title, steps: p.steps.map((s) => s.title) })),
        })),
    },
  });
});

const generateBody = z.object({
  roadmapId: objectId.optional(),
  phaseIndex: z.coerce.number().int().min(0).max(20).optional(),
  topic: z.string().trim().max(120).optional(),
  count: z.coerce.number().int().min(5).max(15).default(10),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
});

practiceRouter.post('/generate', aiLimiter, validate({ body: generateBody }), async (req, res) => {
  const { roadmapId, phaseIndex, count, difficulty } = req.body;
  let roadmap = null;
  let subtopics = [];
  let topic = req.body.topic || '';
  if (roadmapId) {
    roadmap = await Roadmap.findById(roadmapId).lean();
    if (!roadmap || !(await Enrollment.exists({ user: req.user._id, roadmap: roadmap._id }))) throw ApiError.notFound('Choose one of the roadmaps you follow.');
    const phase = phaseIndex !== undefined ? roadmap.phases[phaseIndex] : null;
    const phases = phase ? [phase] : roadmap.phases;
    subtopics = phases.flatMap((p) => p.steps.map((s) => s.title));
    topic ||= phase ? `${roadmap.title}: ${phase.title}` : roadmap.title;
  }
  if (!topic) throw ApiError.badRequest('Pick a roadmap or type a topic.', [{ field: 'topic', message: 'Choose a topic' }]);
  const title = `${topic.slice(0, 120)} — ${difficulty}`;

  // 1) AI quiz (shared cache keeps cost near zero) → 2) confidence check built from the roadmap's own steps.
  const quota = await getQuota(req.user);
  if ((await aiAvailable()) && quota.remaining > 0) {
    try {
      const out = await generateQuestions(
        { topic, count, difficulty, subtopics, context: `${req.user.education?.degree || 'undergraduate'} students` },
        { user: req.user, kind: 'practice', cacheSet: Math.floor(Math.random() * 3) },
      );
      const doc = await Practice.create({ user: req.user._id, roadmap: roadmap?._id, title, kind: 'quiz', source: out.source, difficulty, questions: out.questions });
      return res.status(201).json({ success: true, data: practicePayload(doc) });
    } catch (err) {
      if (!roadmap) throw err; // nothing to fall back on without a roadmap
    }
  }
  if (!roadmap) throw ApiError.unavailable('AI quizzes are unavailable right now. Choose one of your roadmaps for a confidence check instead.', 'AI_UNAVAILABLE');
  const steps = (phaseIndex !== undefined ? [roadmap.phases[phaseIndex]] : roadmap.phases).flatMap((p) => p.steps).slice(0, 15);
  const doc = await Practice.create({
    user: req.user._id,
    roadmap: roadmap._id,
    title: `${topic.slice(0, 120)} — confidence check`,
    kind: 'confidence',
    source: 'confidence',
    questions: steps.map((s) => ({ text: s.title, options: [], topic: s.title })),
  });
  res.status(201).json({ success: true, data: { ...practicePayload(doc), notice: quota.remaining <= 0 ? "You've used today's AI quizzes, so here's a self-rating check built from your roadmap." : 'AI quizzes are unavailable, so here is a self-rating check built from your roadmap.' } });
});

function practicePayload(doc) {
  return {
    _id: doc._id,
    title: doc.title,
    kind: doc.kind,
    source: doc.source,
    difficulty: doc.difficulty,
    status: doc.status,
    questions: doc.questions.map((q) => ({ text: q.text, options: q.options, topic: q.topic })),
  };
}

const submitBody = z.object({ answers: z.array(z.number().int().min(0).max(5).nullable()).max(40) });

function gradePractice(doc, answers) {
  const review = doc.questions.map((q, i) => {
    const a = answers[i] ?? null;
    if (doc.kind === 'confidence') return { text: q.text, topic: q.topic, rating: a, weak: a !== null && a <= 2 || a === null };
    return { text: q.text, options: q.options, correct: q.correct, chosen: a, isCorrect: a === q.correct, explanation: q.explanation, topic: q.topic };
  });
  let percent;
  let score;
  if (doc.kind === 'confidence') {
    const rated = answers.filter((a) => a !== null && a !== undefined);
    score = rated.reduce((s, r) => s + r, 0);
    percent = doc.questions.length ? Math.round((score / (doc.questions.length * 5)) * 100) : 0;
  } else {
    score = review.filter((r) => r.isCorrect).length;
    percent = doc.questions.length ? Math.round((score / doc.questions.length) * 100) : 0;
  }
  const weakTopics = [...new Set(review.filter((r) => (doc.kind === 'confidence' ? r.weak : !r.isCorrect)).map((r) => r.topic).filter(Boolean))];
  return { review, score, percent, weakTopics };
}

practiceRouter.post('/:id/submit', validate({ params: idParam, body: submitBody }), async (req, res) => {
  const doc = await Practice.findOne({ _id: req.params.id, user: req.user._id });
  if (!doc) throw ApiError.notFound('Practice session not found.');
  if (doc.status === 'submitted') throw ApiError.conflict('This practice was already submitted.');
  const { review, score, percent, weakTopics } = gradePractice(doc, req.body.answers);
  doc.answers = doc.questions.map((_, i) => req.body.answers[i] ?? -1);
  doc.status = 'submitted';
  doc.score = score;
  doc.total = doc.kind === 'confidence' ? doc.questions.length * 5 : doc.questions.length;
  doc.percent = percent;
  doc.submittedAt = new Date();
  await doc.save();
  res.json({ success: true, data: { _id: doc._id, title: doc.title, kind: doc.kind, roadmap: doc.roadmap, score, total: doc.total, percent, review, weakTopics } });
});

practiceRouter.get('/history', async (req, res) => {
  const items = await Practice.find({ user: req.user._id, status: 'submitted' }).sort({ submittedAt: -1 }).limit(60).populate('roadmap', 'title slug').lean();
  const byRoadmap = new Map();
  for (const p of [...items].reverse()) {
    if (!p.roadmap) continue;
    const k = String(p.roadmap._id);
    const row = byRoadmap.get(k) || { roadmapId: p.roadmap._id, title: p.roadmap.title, slug: p.roadmap.slug, attempts: 0, trend: [] };
    row.attempts += 1;
    row.trend.push(p.percent);
    byRoadmap.set(k, row);
  }
  res.json({
    success: true,
    data: {
      items: items.slice(0, 20).map((p) => ({ _id: p._id, title: p.title, kind: p.kind, percent: p.percent, submittedAt: p.submittedAt })),
      roadmaps: [...byRoadmap.values()].map((r) => ({ ...r, trend: r.trend.slice(-8), average: Math.round(r.trend.reduce((a, b) => a + b, 0) / r.trend.length), last: r.trend.at(-1) })),
    },
  });
});

practiceRouter.get('/:id', validate({ params: idParam }), async (req, res) => {
  const doc = await Practice.findOne({ _id: req.params.id, user: req.user._id });
  if (!doc) throw ApiError.notFound('Practice session not found.');
  if (doc.status === 'open') return res.json({ success: true, data: practicePayload(doc) });
  const { review, weakTopics } = gradePractice(doc, doc.answers.map((a) => (a < 0 ? null : a)));
  res.json({ success: true, data: { _id: doc._id, title: doc.title, kind: doc.kind, roadmap: doc.roadmap, score: doc.score, total: doc.total, percent: doc.percent, review, weakTopics, status: 'submitted' } });
});
