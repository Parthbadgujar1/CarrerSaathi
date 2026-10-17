/**
 * AI multiple-choice question generation. Uses the same provider chain as the rest of the
 * platform (every configured key, rotated, circuit-broken), so admins can add many keys.
 * Output is strictly validated: bad or ambiguous questions are dropped, never shown.
 */
import { z } from 'zod';
import { AiCache, AiLog } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { sha256 } from '../../utils/helpers.js';
import { runCompletion } from './ai.service.js';
import { configuredProviders } from './keyPool.js';

const itemSchema = z.object({
  question: z.string().trim().min(8).max(900),
  options: z.array(z.string().trim().min(1).max(300)).length(4),
  answer: z.union([z.number().int().min(0).max(3), z.string()]),
  explanation: z.string().trim().max(700).optional().default(''),
  topic: z.string().trim().max(120).optional().default(''),
});

const LETTERS = ['a', 'b', 'c', 'd'];

function normalise(raw, wanted) {
  const list = Array.isArray(raw?.questions) ? raw.questions : Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const parsed = itemSchema.safeParse(item);
    if (!parsed.success) continue;
    const q = parsed.data;
    let correct = typeof q.answer === 'number' ? q.answer : LETTERS.indexOf(String(q.answer).trim().toLowerCase().charAt(0));
    if (typeof q.answer === 'string' && /^[1-4]$/.test(q.answer.trim())) correct = Number(q.answer) - 1;
    if (correct < 0 || correct > 3) continue;
    if (new Set(q.options.map((o) => o.toLowerCase())).size !== 4) continue; // duplicate options
    const key = q.question.toLowerCase().replace(/\W+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: q.question, options: q.options, correct, explanation: q.explanation, topic: q.topic, marks: 1 });
  }
  if (out.length < Math.max(1, Math.ceil(wanted * 0.6))) {
    const err = new Error('Model returned too few valid questions');
    err.kind = 'bad_output';
    throw err;
  }
  return out.slice(0, wanted);
}

const SYSTEM = `You write high-quality multiple-choice questions for college students in India.
Return ONLY a JSON object: {"questions":[{"question":string,"options":[4 strings],"answer":0-3 (index of the correct option),"explanation":string (1-2 sentences),"topic":string}]}
Rules: exactly 4 distinct options; exactly ONE clearly correct option; test understanding, not trivia; no "all of the above"/"none of the above"; facts must be accurate and current; keep wording concise; vary the position of the correct answer; the "topic" must be a short label (use one of the given subtopics when provided).`;

/**
 * @param {{topic:string, count:number, difficulty?:string, context?:string, subtopics?:string[], instructions?:string}} p
 */
export async function generateQuestions(p, { user, kind = 'test-gen', cacheSet } = {}) {
  const count = Math.min(40, Math.max(3, Number(p.count) || 10));
  const difficulty = ['easy', 'medium', 'hard'].includes(p.difficulty) ? p.difficulty : 'medium';

  if (!configuredProviders().length) {
    throw ApiError.unavailable('No AI key is configured. Add one under Admin → System → AI, or upload questions from Excel.', 'AI_NOT_CONFIGURED');
  }

  // Practice quizzes are cached in a few shared "sets" per topic, so many students cost one AI call.
  let cacheKey;
  if (cacheSet !== undefined) {
    cacheKey = `quiz:v1:${sha256(JSON.stringify({ t: p.topic.toLowerCase(), s: p.subtopics, count, difficulty, set: cacheSet }))}`;
    const hit = await AiCache.findOneAndUpdate({ key: cacheKey, expiresAt: { $gt: new Date() } }, { $inc: { hits: 1 } }, { new: true }).lean();
    if (hit) {
      AiLog.create({ user: user?._id, kind, source: 'cache', provider: hit.provider, success: true }).catch(() => {});
      return { questions: hit.payload, provider: hit.provider, source: 'cache' };
    }
  }

  const prompt = JSON.stringify({
    topic: p.topic,
    questionCount: count,
    difficulty,
    audience: p.context || 'undergraduate students',
    subtopics: (p.subtopics || []).slice(0, 12),
    extraInstructions: (p.instructions || '').slice(0, 500) || undefined,
  });
  const started = Date.now();
  try {
    const { output, provider } = await runCompletion({
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
      json: true,
      maxTokens: Math.min(7000, 300 + count * 230),
      temperature: 0.6,
      validate: (raw) => normalise(raw, count),
    });
    AiLog.create({ user: user?._id, kind, source: 'ai', provider, success: true, latencyMs: Date.now() - started }).catch(() => {});
    if (cacheKey) {
      await AiCache.updateOne({ key: cacheKey }, { $set: { kind: 'quiz', payload: output, provider, expiresAt: new Date(Date.now() + 14 * 86_400_000) } }, { upsert: true }).catch(() => {});
    }
    return { questions: output, provider, source: 'ai' };
  } catch (err) {
    AiLog.create({ user: user?._id, kind, source: 'ai', success: false, error: err.message?.slice(0, 200) }).catch(() => {});
    throw ApiError.unavailable('The AI providers could not generate questions right now. Please try again in a moment, or upload questions from Excel.', 'AI_UNAVAILABLE');
  }
}
