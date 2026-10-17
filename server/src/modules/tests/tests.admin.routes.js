import express, { Router } from 'express';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { aiLimiter } from '../../middleware/rateLimiters.js';
import { Attempt, Roadmap, Test, User } from '../../models/index.js';
import { ROLES, USER_STATUS } from '../../config/constants.js';
import { ApiError } from '../../utils/ApiError.js';
import { objectId, text } from '../../utils/schemas.js';
import { audit } from '../../services/audit.service.js';
import { notify } from '../../services/notification.service.js';
import { generateQuestions } from '../../services/ai/questions.service.js';
import { buildTemplate, parseQuestionFile } from './excel.js';
import { audienceUserFilter, countAudience, totalMarks, windowState } from './tests.service.js';

const router = Router();
router.use(authenticate, authorize(ROLES.ADMIN));
const idParam = z.object({ id: objectId });

const questionSchema = z
  .object({
    text: text(1000, 5),
    options: z.array(text(400, 1)).min(2).max(6),
    correct: z.coerce.number().int().min(0).max(5),
    explanation: text(1000).optional().default(''),
    topic: text(120).optional().default(''),
    marks: z.coerce.number().min(0.25).max(20).optional().default(1),
  })
  .refine((q) => q.correct < q.options.length, { message: 'The correct answer must point at one of the options', path: ['correct'] })
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === q.options.length, { message: 'Options must be different from each other', path: ['options'] });

const audienceSchema = z
  .object({
    degrees: z.array(text(80, 1)).max(30).default([]),
    graduationYears: z.array(z.coerce.number().int().min(1990).max(2100)).max(12).default([]),
    currentYears: z.array(z.coerce.number().int().min(1).max(6)).max(6).default([]),
    colleges: z.array(text(160, 1)).max(100).default([]),
    tracks: z.array(text(80, 1)).max(30).default([]),
  })
  .default({ degrees: [], graduationYears: [], currentYears: [], colleges: [], tracks: [] });

const testBody = z
  .object({
    title: text(140, 3),
    description: text(1500).optional().default(''),
    instructions: text(2000).optional().default(''),
    source: z.enum(['excel', 'ai', 'manual', 'mixed']).default('manual'),
    questions: z.array(questionSchema).max(300).default([]),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    durationMinutes: z.coerce.number().int().min(5).max(360).default(30),
    passPercent: z.coerce.number().min(0).max(100).default(40),
    maxAttempts: z.coerce.number().int().min(1).max(10).default(1),
    shuffleQuestions: z.boolean().default(true),
    showResults: z.enum(['immediate', 'after-end', 'never']).default('immediate'),
    audience: audienceSchema,
    status: z.enum(['draft', 'published']).default('draft'),
  })
  .refine((t) => t.endAt > t.startAt, { message: 'The end time must be after the start time', path: ['endAt'] })
  .refine((t) => t.status !== 'published' || t.questions.length > 0, { message: 'Add at least one question before publishing', path: ['questions'] });

async function notifyAudience(test) {
  const students = await User.find(audienceUserFilter(test.audience)).select('_id').limit(10_000).lean();
  await notify(
    students.map((s) => s._id),
    {
      type: 'test',
      title: `New test: ${test.title}`,
      body: `${test.startAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST · ${test.durationMinutes} min · ${test.questions.length} questions`,
      link: '/app/tests',
    },
  );
  await Test.updateOne({ _id: test._id }, { notifiedAt: new Date() });
  return students.length;
}

// ---------------------------------------------------------------- helpers for the builder
router.get('/template.xlsx', async (_req, res) => {
  const buf = await buildTemplate();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="careersaathi-test-template.xlsx"');
  res.send(Buffer.from(buf));
});

/** Upload is raw bytes (octet-stream) so no multipart dependency is needed; nothing is saved here — it only previews. */
router.post('/parse-excel', express.raw({ type: '*/*', limit: '5mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw ApiError.badRequest('Choose an .xlsx or .csv file to upload.');
  const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
  const { questions, errors } = await parseQuestionFile(req.body, format);
  res.json({ success: true, data: { questions, errors } });
});

router.post(
  '/generate-questions',
  aiLimiter,
  validate({ body: z.object({ topic: text(160, 3), count: z.coerce.number().int().min(3).max(40).default(10), difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'), context: text(200).optional().default(''), instructions: text(500).optional().default('') }) }),
  async (req, res) => {
    const out = await generateQuestions(req.body, { user: req.user, kind: 'test-gen' });
    audit(req, 'test.generate', { meta: { topic: req.body.topic, count: out.questions.length, provider: out.provider } });
    res.json({ success: true, data: out });
  },
);

router.get('/audience-options', async (_req, res) => {
  const base = { role: ROLES.STUDENT, status: USER_STATUS.ACTIVE };
  const [degrees, colleges, years, current, tracks] = await Promise.all([
    User.distinct('education.degree', base),
    User.distinct('education.college', base),
    User.distinct('education.graduationYear', base),
    User.distinct('education.currentYear', base),
    User.distinct('careerTracks', base),
  ]);
  const titles = new Map((await Roadmap.find({ slug: { $in: tracks } }).select('slug title').lean()).map((r) => [r.slug, r.title]));
  const clean = (arr) => arr.filter(Boolean);
  res.json({
    success: true,
    data: {
      degrees: clean(degrees).sort(),
      colleges: clean(colleges).sort(),
      graduationYears: clean(years).sort(),
      currentYears: clean(current).sort(),
      tracks: clean(tracks).map((slug) => ({ slug, title: titles.get(slug) || slug })),
    },
  });
});

router.post('/audience-preview', validate({ body: z.object({ audience: audienceSchema }) }), async (req, res) => {
  res.json({ success: true, data: { count: await countAudience(req.body.audience) } });
});

// ---------------------------------------------------------------- CRUD
router.get('/', async (req, res) => {
  const filter = req.query.status ? { status: String(req.query.status) } : { status: { $ne: 'archived' } };
  const tests = await Test.find(filter).sort({ startAt: -1 }).limit(200).lean();
  const stats = await Attempt.aggregate([
    { $match: { test: { $in: tests.map((t) => t._id) } } },
    { $group: { _id: '$test', attempts: { $sum: 1 }, submitted: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } }, avg: { $avg: { $cond: [{ $eq: ['$status', 'submitted'] }, '$percent', null] } }, takers: { $addToSet: '$user' } } },
  ]);
  const by = new Map(stats.map((s) => [String(s._id), s]));
  res.json({
    success: true,
    data: tests.map((t) => ({
      _id: t._id,
      title: t.title,
      status: t.status,
      state: windowState(t),
      source: t.source,
      startAt: t.startAt,
      endAt: t.endAt,
      durationMinutes: t.durationMinutes,
      questionCount: t.questions.length,
      totalMarks: totalMarks(t),
      passPercent: t.passPercent,
      audience: t.audience,
      attempts: by.get(String(t._id))?.attempts || 0,
      takers: by.get(String(t._id))?.takers.length || 0,
      averagePercent: by.get(String(t._id))?.avg != null ? Math.round(by.get(String(t._id)).avg * 10) / 10 : null,
    })),
  });
});

router.post('/', validate({ body: testBody }), async (req, res) => {
  const test = await Test.create({ ...req.body, createdBy: req.user._id });
  let notified = 0;
  if (test.status === 'published') notified = await notifyAudience(test);
  audit(req, 'test.create', { targetType: 'test', targetId: test._id, meta: { title: test.title, status: test.status, questions: test.questions.length } });
  res.status(201).json({ success: true, data: test, message: test.status === 'published' ? `Test published and ${notified} students notified.` : 'Test saved as a draft.' });
});

router.get('/:id', validate({ params: idParam }), async (req, res) => {
  const test = await Test.findById(req.params.id).lean();
  if (!test) throw ApiError.notFound('Test not found.');
  res.json({ success: true, data: { ...test, hasAttempts: Boolean(await Attempt.exists({ test: test._id })), audienceCount: await countAudience(test.audience) } });
});

router.put('/:id', validate({ params: idParam, body: testBody }), async (req, res) => {
  const test = await Test.findById(req.params.id);
  if (!test) throw ApiError.notFound('Test not found.');
  const started = await Attempt.exists({ test: test._id });
  const { questions, ...rest } = req.body;
  Object.assign(test, rest);
  if (!started) test.questions = questions; // answers can't change under students who already took it
  const first = test.status === 'published' && !test.notifiedAt;
  await test.save();
  const notified = first ? await notifyAudience(test) : 0;
  audit(req, 'test.update', { targetType: 'test', targetId: test._id });
  res.json({ success: true, data: test, message: started ? 'Details saved. Questions are locked because students have already started this test.' : first ? `Saved and published — ${notified} students notified.` : 'Test updated.' });
});

router.patch('/:id/status', validate({ params: idParam, body: z.object({ status: z.enum(['draft', 'published', 'archived']) }) }), async (req, res) => {
  const test = await Test.findById(req.params.id);
  if (!test) throw ApiError.notFound('Test not found.');
  if (req.body.status === 'published' && !test.questions.length) throw ApiError.badRequest('Add questions before publishing.');
  test.status = req.body.status;
  await test.save();
  const notified = req.body.status === 'published' && !test.notifiedAt ? await notifyAudience(test) : 0;
  audit(req, `test.${req.body.status}`, { targetType: 'test', targetId: test._id });
  res.json({ success: true, message: notified ? `Published — ${notified} students notified.` : `Test ${req.body.status}.` });
});

router.post('/:id/duplicate', validate({ params: idParam }), async (req, res) => {
  const src = await Test.findById(req.params.id).lean();
  if (!src) throw ApiError.notFound('Test not found.');
  const { _id, createdAt, updatedAt, notifiedAt, reminderSent, status, ...copy } = src;
  const test = await Test.create({ ...copy, title: `${src.title} (copy)`, status: 'draft', createdBy: req.user._id, questions: src.questions.map(({ _id: _q, ...q }) => q) });
  res.status(201).json({ success: true, data: { _id: test._id }, message: 'Copied as a draft — set new dates and publish.' });
});

router.delete('/:id', validate({ params: idParam }), async (req, res) => {
  const test = await Test.findByIdAndDelete(req.params.id);
  if (!test) throw ApiError.notFound('Test not found.');
  const { deletedCount } = await Attempt.deleteMany({ test: test._id });
  audit(req, 'test.delete', { targetType: 'test', targetId: test._id, meta: { title: test.title, attempts: deletedCount } });
  res.json({ success: true, message: `Test and ${deletedCount} attempt${deletedCount === 1 ? '' : 's'} deleted.` });
});

// ---------------------------------------------------------------- results
async function resultsData(testId) {
  const test = await Test.findById(testId).lean();
  if (!test) throw ApiError.notFound('Test not found.');
  const attempts = await Attempt.find({ test: test._id, status: 'submitted' }).sort({ submittedAt: -1 }).populate('user', 'name email education.college education.degree education.currentYear education.graduationYear').lean();
  return { test, attempts };
}

router.get('/:id/results', validate({ params: idParam }), async (req, res) => {
  const { test, attempts } = await resultsData(req.params.id);
  const percents = attempts.map((a) => a.percent);
  const perQuestion = test.questions.map((q) => {
    let right = 0;
    let answered = 0;
    for (const a of attempts) {
      const ans = a.answers.find((x) => String(x.q) === String(q._id));
      if (ans) answered += 1;
      if (ans?.choice === q.correct) right += 1;
    }
    return { _id: q._id, text: q.text, topic: q.topic, correctPercent: attempts.length ? Math.round((right / attempts.length) * 100) : null, answered };
  });
  const assigned = await countAudience(test.audience);
  const takers = new Set(attempts.map((a) => String(a.user?._id)));
  res.json({
    success: true,
    data: {
      test: { _id: test._id, title: test.title, passPercent: test.passPercent, questionCount: test.questions.length, startAt: test.startAt, endAt: test.endAt, status: test.status },
      stats: {
        assigned,
        attempted: takers.size,
        notAttempted: Math.max(0, assigned - takers.size),
        submissions: attempts.length,
        average: percents.length ? Math.round((percents.reduce((a, b) => a + b, 0) / percents.length) * 10) / 10 : null,
        highest: percents.length ? Math.max(...percents) : null,
        lowest: percents.length ? Math.min(...percents) : null,
        passRate: attempts.length ? Math.round((attempts.filter((a) => a.passed).length / attempts.length) * 100) : null,
      },
      attempts: attempts.map((a) => ({ _id: a._id, user: a.user, score: a.score, total: a.total, percent: a.percent, passed: a.passed, timeTakenSec: a.timeTakenSec, submittedAt: a.submittedAt, autoSubmitted: a.autoSubmitted })),
      perQuestion,
    },
  });
});

router.get('/:id/results.xlsx', validate({ params: idParam }), async (req, res) => {
  const { test, attempts } = await resultsData(req.params.id);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Results', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Name', key: 'name', width: 24 }, { header: 'Email', key: 'email', width: 30 }, { header: 'College', key: 'college', width: 30 },
    { header: 'Degree', key: 'degree', width: 14 }, { header: 'Current year', key: 'cy', width: 12 }, { header: 'Graduation year', key: 'gy', width: 14 },
    { header: 'Score', key: 'score', width: 10 }, { header: 'Out of', key: 'total', width: 10 }, { header: 'Percent', key: 'percent', width: 10 },
    { header: 'Result', key: 'result', width: 10 }, { header: 'Time (min)', key: 'time', width: 11 }, { header: 'Submitted at', key: 'at', width: 20 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const a of attempts) {
    ws.addRow({
      name: a.user?.name, email: a.user?.email, college: a.user?.education?.college, degree: a.user?.education?.degree,
      cy: a.user?.education?.currentYear, gy: a.user?.education?.graduationYear, score: a.score, total: a.total, percent: a.percent,
      result: a.passed ? 'Pass' : 'Fail', time: a.timeTakenSec ? Math.round(a.timeTakenSec / 6) / 10 : '', at: a.submittedAt,
    });
  }
  ws.getColumn('at').numFmt = 'dd-mmm-yyyy hh:mm';
  const safe = test.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 40);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="results-${safe}.xlsx"`);
  audit(req, 'test.results.export', { targetType: 'test', targetId: test._id, meta: { rows: attempts.length } });
  await wb.xlsx.write(res);
  res.end();
});

export default router;
