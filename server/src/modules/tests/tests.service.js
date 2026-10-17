import { Attempt, Test, User } from '../../models/index.js';
import { ROLES, USER_STATUS } from '../../config/constants.js';
import { escapeRegex } from '../../utils/helpers.js';

export const GRACE_MS = 30_000; // tolerance for network delay when a student submits at the buzzer

const lower = (v) => String(v || '').trim().toLowerCase();

/** Does this student belong to the test's audience? Empty lists mean "everyone". */
export function matchesAudience(user, aud = {}) {
  const has = (arr) => Array.isArray(arr) && arr.length > 0;
  if (has(aud.degrees) && !aud.degrees.map(lower).includes(lower(user.education?.degree))) return false;
  if (has(aud.colleges) && !aud.colleges.map(lower).includes(lower(user.education?.college))) return false;
  if (has(aud.graduationYears) && !aud.graduationYears.includes(user.education?.graduationYear)) return false;
  if (has(aud.currentYears) && !aud.currentYears.includes(user.education?.currentYear)) return false;
  if (has(aud.tracks) && !aud.tracks.some((t) => (user.careerTracks || []).includes(t))) return false;
  return true;
}

/** MongoDB filter for the students an audience selects (used for counts and notifications). */
export function audienceUserFilter(aud = {}) {
  const f = { role: ROLES.STUDENT, status: USER_STATUS.ACTIVE };
  const exact = (arr) => arr.map((s) => new RegExp(`^${escapeRegex(s)}$`, 'i'));
  if (aud.degrees?.length) f['education.degree'] = { $in: exact(aud.degrees) };
  if (aud.colleges?.length) f['education.college'] = { $in: exact(aud.colleges) };
  if (aud.graduationYears?.length) f['education.graduationYear'] = { $in: aud.graduationYears };
  if (aud.currentYears?.length) f['education.currentYear'] = { $in: aud.currentYears };
  if (aud.tracks?.length) f.careerTracks = { $in: aud.tracks };
  return f;
}

export const countAudience = (aud) => User.countDocuments(audienceUserFilter(aud));

export function windowState(test, now = new Date()) {
  if (test.status !== 'published') return test.status;
  if (now < test.startAt) return 'upcoming';
  if (now > test.endAt) return 'closed';
  return 'open';
}

export const totalMarks = (test) => test.questions.reduce((s, q) => s + (q.marks || 1), 0);

/** Per-attempt deadline = start + duration, never later than the test window closes. */
export function attemptDeadline(test, startedAt = new Date()) {
  return new Date(Math.min(startedAt.getTime() + test.durationMinutes * 60_000, test.endAt.getTime() + GRACE_MS));
}

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const questionOrder = (test) => (test.shuffleQuestions ? shuffle(test.questions.map((q) => q._id)) : test.questions.map((q) => q._id));

/** The questions a student may see: no correct answers, no explanations. */
export function studentQuestions(test, order) {
  const byId = new Map(test.questions.map((q) => [String(q._id), q]));
  return order
    .map((id) => byId.get(String(id)))
    .filter(Boolean)
    .map((q) => ({ _id: q._id, text: q.text, options: q.options, marks: q.marks, topic: q.topic }));
}

/** Grades and closes an attempt exactly once (atomic status flip guards against double-submits). */
export async function finalizeAttempt(attemptId, { answers, auto = false } = {}) {
  const attempt = await Attempt.findById(attemptId);
  if (!attempt || attempt.status === 'submitted') return attempt;
  const test = await Test.findById(attempt.test).lean();
  if (!test) return attempt;

  let chosen = new Map(attempt.answers.map((a) => [String(a.q), a.choice]));
  if (answers) {
    const accept = Date.now() <= attempt.deadline.getTime() + GRACE_MS; // late submissions fall back to the autosaved answers
    if (accept) chosen = new Map([...chosen, ...Object.entries(answers).filter(([, c]) => Number.isInteger(c) || c === null)]);
  }
  let score = 0;
  const saved = [];
  for (const q of test.questions) {
    const choice = chosen.get(String(q._id));
    if (choice !== undefined && choice !== null) saved.push({ q: q._id, choice });
    if (choice === q.correct) score += q.marks || 1;
  }
  const total = totalMarks(test);
  const percent = total ? Math.round((score / total) * 1000) / 10 : 0;
  const submittedAt = new Date(Math.min(Date.now(), attempt.deadline.getTime()));

  const res = await Attempt.findOneAndUpdate(
    { _id: attempt._id, status: 'in_progress' },
    {
      $set: {
        status: 'submitted',
        submittedAt,
        autoSubmitted: auto,
        answers: saved,
        score,
        total,
        percent,
        passed: percent >= test.passPercent,
        timeTakenSec: Math.max(1, Math.round((submittedAt - attempt.startedAt) / 1000)),
      },
    },
    { new: true },
  );
  return res || Attempt.findById(attemptId);
}

/** Result payload for a student. Answer review follows the test's `showResults` policy. */
export function resultFor(attempt, test, now = new Date()) {
  const reviewAllowed = test.showResults === 'immediate' || (test.showResults === 'after-end' && now > test.endAt);
  const base = {
    _id: attempt._id,
    test: { _id: test._id, title: test.title, passPercent: test.passPercent, showResults: test.showResults, endAt: test.endAt },
    status: attempt.status,
    score: attempt.score,
    total: attempt.total,
    percent: attempt.percent,
    passed: attempt.passed,
    timeTakenSec: attempt.timeTakenSec,
    submittedAt: attempt.submittedAt,
    autoSubmitted: attempt.autoSubmitted,
    reviewAvailable: reviewAllowed,
  };
  if (!reviewAllowed) return base;
  const chosen = new Map(attempt.answers.map((a) => [String(a.q), a.choice]));
  const byId = new Map(test.questions.map((q) => [String(q._id), q]));
  const order = attempt.order?.length ? attempt.order : test.questions.map((q) => q._id);
  return {
    ...base,
    review: order
      .map((id) => byId.get(String(id)))
      .filter(Boolean)
      .map((q) => ({
        _id: q._id,
        text: q.text,
        options: q.options,
        correct: q.correct,
        chosen: chosen.has(String(q._id)) ? chosen.get(String(q._id)) : null,
        isCorrect: chosen.get(String(q._id)) === q.correct,
        explanation: q.explanation,
        topic: q.topic,
        marks: q.marks,
      })),
  };
}
