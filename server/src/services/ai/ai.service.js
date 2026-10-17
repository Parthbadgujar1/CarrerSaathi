/**
 * AI orchestration with aggressive cost control. Order of resolution:
 *   1. Library first  — a strong match in the curated library costs nothing.
 *   2. Shared cache   — normalised + bucketed requests hit MongoDB cache (30 days).
 *   3. Quota check    — per-user daily limit protects the budget.
 *   4. Providers      — configured order (default Groq → Gemini → OpenAI), keys rotated,
 *                       broken keys parked by the circuit breaker, compact prompts, capped tokens.
 *   5. Fallback       — curated library blend / rule-based answers. Never fails.
 */
import { z } from 'zod';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AiCache, AiLog, Roadmap } from '../../models/index.js';
import { getSettings } from '../settings.service.js';
import { sha256, startOfDay, slugify } from '../../utils/helpers.js';
import { providers, ProviderError } from './providers.js';
import { getAiOrder, getProviderConfig } from './aiConfig.service.js';
import { availableKeys, configuredProviders, reportFailure, reportSuccess, poolStatus } from './keyPool.js';
import { matchLibrary, blendRoadmaps, ruleBasedAnswer, isCrisis } from './fallback.js';
import { CRISIS_RESPONSE } from '../../data/careerData.js';

const MAX_ATTEMPTS = 4;

// ---------------------------------------------------------------- core runner
export async function runCompletion({ system, messages, json = false, maxTokens = 600, temperature = 0.4, validate, only }) {
  const order = only ? [only] : configuredProviders();
  let attempts = 0;
  let lastErr = null;
  for (const provider of order) {
    const cfg = getProviderConfig(provider);
    for (const key of availableKeys(provider)) {
      if (attempts >= MAX_ATTEMPTS) break;
      attempts += 1;
      const started = Date.now();
      try {
        const text = await providers[provider].call({
          key,
          model: cfg.model,
          system,
          messages,
          json,
          maxTokens,
          temperature,
          timeoutMs: env.ai.timeoutMs,
        });
        let output = text.trim();
        if (json) output = parseJsonLoose(output);
        if (validate) output = validate(output);
        reportSuccess(provider, key);
        return { output, provider, latencyMs: Date.now() - started };
      } catch (err) {
        const e = err instanceof ProviderError ? err : new ProviderError(err.message, { kind: 'bad_output' });
        lastErr = e;
        if (e.kind !== 'bad_output') reportFailure(provider, key, e);
        logger.warn(`AI ${provider} failed`, { kind: e.kind, status: e.status, message: e.message });
        // Model misconfiguration affects every key of this provider — move on.
        if (e.kind === 'bad_request' || e.kind === 'bad_output') break;
      }
    }
  }
  const err = new Error(lastErr ? `All AI providers failed (${lastErr.kind})` : 'No AI provider available');
  err.code = 'AI_UNAVAILABLE';
  throw err;
}

function parseJsonLoose(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new ProviderError('Model did not return valid JSON', { kind: 'bad_output' });
  }
}

// ---------------------------------------------------------------- quota & logs
async function quotaState(user) {
  const settings = await getSettings();
  const limit = user.role === 'student' ? settings.aiDailyLimitStudent : settings.aiDailyLimitStaff;
  const used = await AiLog.countDocuments({ user: user._id, source: 'ai', createdAt: { $gte: startOfDay() } });
  return { enabled: settings.aiEnabled, limit, used, remaining: Math.max(0, limit - used) };
}

function logCall(user, kind, source, extra = {}) {
  AiLog.create({ user: user?._id, kind, source, success: true, ...extra }).catch(() => {});
}

async function cacheGet(key) {
  const hit = await AiCache.findOneAndUpdate({ key, expiresAt: { $gt: new Date() } }, { $inc: { hits: 1 } }, { new: true }).lean();
  return hit;
}

async function cacheSet(key, kind, payload, provider, ttlDays = env.ai.cacheTtlDays) {
  await AiCache.updateOne(
    { key },
    { $set: { kind, payload, provider, expiresAt: new Date(Date.now() + ttlDays * 86_400_000) } },
    { upsert: true },
  ).catch((err) => logger.warn('AI cache write failed', { message: err.message }));
}

// ---------------------------------------------------------------- roadmap generation
const ALLOWED_RESOURCE_HOSTS = [
  'developer.mozilla.org', 'freecodecamp.org', 'nptel.ac.in', 'swayam.gov.in', 'coursera.org', 'edx.org',
  'khanacademy.org', 'kaggle.com', 'docs.python.org', 'react.dev', 'roadmap.sh', 'youtube.com', 'w3schools.com',
  'geeksforgeeks.org', 'learn.microsoft.com', 'skillbuilder.aws', 'cloudskillsboost.google', 'developer.android.com',
  'docs.flutter.dev', 'academy.hubspot.com', 'skillshop.withgoogle.com', 'zerodha.com', 'nism.ac.in', 'owasp.org',
  'tryhackme.com', 'portswigger.net', 'huggingface.co', 'course.fast.ai', 'github.com', 'leetcode.com', 'hackerrank.com',
  'neetcode.io', 'sqlbolt.com', 'ncert.nic.in', 'upsc.gov.in', 'theodinproject.com', 'javascript.info', 'nodejs.org',
  'docs.docker.com', 'kubernetes.io', 'scikit-learn.org', 'pytorch.org', 'figma.com', 'nngroup.com', 'lawsofux.com',
  'shrm.org', 'cipd.org', 'icai.org', 'git-scm.com', 'typescriptlang.org', 'developers.google.com', 'aws.amazon.com',
  'docs.github.com', 'learn.mongodb.com', 'mongodb.com', 'postgresql.org', 'autodesk.com', 'arduino.cc', 'docs.arduino.cc',
  'raspberrypi.com', 'chipverify.com', 'semrush.com', 'canva.com', 'netacad.com', 'cert-in.org.in', 'data.gov.in',
];

const hostAllowed = (url) => {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const host = u.hostname.replace(/^www\./, '');
    return ALLOWED_RESOURCE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

const aiRoadmapSchema = z.object({
  title: z.string().min(3).max(120),
  summary: z.string().max(600).default(''),
  duration: z.string().max(40).default(''),
  roles: z.array(z.string().max(80)).max(10).default([]),
  skills: z.array(z.string().max(60)).max(25).default([]),
  phases: z
    .array(
      z.object({
        title: z.string().min(2).max(120),
        duration: z.string().max(40).default(''),
        steps: z
          .array(
            z.object({
              title: z.string().min(2).max(160),
              description: z.string().max(800).default(''),
              isProject: z.boolean().default(false),
              resources: z
                .array(z.object({ title: z.string().max(160), url: z.string().max(400), type: z.string().max(20).optional() }))
                .max(4)
                .default([]),
            }),
          )
          .min(1)
          .max(8),
      }),
    )
    .min(2)
    .max(8),
});

const RESOURCE_TYPES = new Set(['course', 'doc', 'video', 'practice', 'book', 'community', 'tool']);

/** Validates model output, drops hallucinated links, assigns stable step keys. */
function normaliseAiRoadmap(raw) {
  const parsed = aiRoadmapSchema.safeParse(raw);
  if (!parsed.success) throw new ProviderError('Roadmap JSON did not match schema', { kind: 'bad_output' });
  const r = parsed.data;
  return {
    ...r,
    phases: r.phases.map((phase, pi) => ({
      title: phase.title,
      duration: phase.duration,
      steps: phase.steps.map((step, si) => {
        const resources = step.resources
          .filter((res) => hostAllowed(res.url))
          .map((res) => ({ title: res.title, url: res.url, type: RESOURCE_TYPES.has(res.type) ? res.type : 'course', free: true }));
        if (!resources.length) {
          resources.push({
            title: `Video tutorials: ${step.title}`,
            url: `https://www.youtube.com/results?search_query=${encodeURIComponent(step.title)}`,
            type: 'video',
            free: true,
          });
        }
        return { key: `p${pi + 1}s${si + 1}-${slugify(step.title).slice(0, 30)}`, title: step.title, description: step.description, isProject: step.isProject, resources };
      }),
    })),
  };
}

const bucket = (value, steps) => steps.find((s) => value <= s) ?? steps[steps.length - 1];

export function normaliseRoadmapInput(input) {
  return {
    fields: [...new Set(input.fields.map((f) => f.trim().toLowerCase()).filter(Boolean))].sort().slice(0, 4),
    level: input.level || 'beginner',
    hoursPerWeek: bucket(input.hoursPerWeek || 10, [5, 10, 20, 40]),
    timelineMonths: bucket(input.timelineMonths || 6, [3, 6, 12, 24]),
    goal: String(input.goal || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 160),
    degree: String(input.degree || '').trim().toLowerCase().slice(0, 60),
  };
}

const ROADMAP_SYSTEM = `You create concise, practical career roadmaps for Indian college students (after 12th, any degree).
Return ONLY a JSON object with this exact shape:
{"title":string,"summary":string(<=300 chars),"duration":string,"roles":[string],"skills":[string],
 "phases":[{"title":string,"duration":string,"steps":[{"title":string,"description":string(<=200 chars),"isProject":boolean,
 "resources":[{"title":string,"url":string,"type":"course|doc|video|practice|book"}]}]}]}
Rules: 3-5 phases, 3-4 steps per phase, at least one project step per phase after the first, max 2 resources per step.
Prefer FREE, well-known resources (NPTEL, SWAYAM, freeCodeCamp, MDN, Kaggle, Microsoft Learn, Google Skillshop, HubSpot Academy, official docs).
Use only real root URLs you are certain exist. Include an "industry readiness" final phase (interviews, portfolio, networking).
Respect the student's weekly hours and timeline. No markdown, no commentary.`;

/**
 * Generates a roadmap preview. Returns
 * { source, provider?, notice?, libraryRoadmap?, draftKey?, roadmap }
 */
export async function generateRoadmap(rawInput, user) {
  const input = normaliseRoadmapInput(rawInput);
  const started = Date.now();
  const library = await Roadmap.find({ isPublished: true, owner: null }).lean();
  const matches = matchLibrary(input.fields, library);

  // 1. Library first (single field, strong match, AI not explicitly requested)
  if (!rawInput.forceAI && input.fields.length === 1 && matches[0]?.strong) {
    logCall(user, 'roadmap', 'library', { latencyMs: Date.now() - started });
    return { source: 'library', libraryRoadmap: matches[0].roadmap, roadmap: matches[0].roadmap };
  }

  const key = `roadmap:v1:${sha256(JSON.stringify(input))}`;

  // 2. Shared cache
  const cached = await cacheGet(key);
  if (cached) {
    logCall(user, 'roadmap', 'cache', { provider: cached.provider, latencyMs: Date.now() - started });
    return { source: 'cache', provider: cached.provider, draftKey: key, roadmap: cached.payload };
  }

  // 3. Quota + availability
  const quota = await quotaState(user);
  let notice = null;
  if (!quota.enabled) notice = 'AI generation is currently turned off by the admin, so here is a curated plan instead.';
  else if (!configuredProviders().length) notice = 'AI is not configured on this server, so here is a curated plan instead.';
  else if (quota.remaining <= 0) notice = `You have used today's ${quota.limit} AI generations. Here is a curated plan; AI resets tomorrow.`;

  // 4. Providers
  if (!notice) {
    try {
      const { output, provider, latencyMs } = await runCompletion({
        system: ROADMAP_SYSTEM,
        messages: [{ role: 'user', content: JSON.stringify(input) }],
        json: true,
        maxTokens: 2800,
        temperature: 0.3,
        validate: normaliseAiRoadmap,
      });
      const best = matches.filter((m) => m.roadmap).sort((a, b) => b.score - a.score)[0]?.roadmap;
      const roadmap = {
        ...output,
        category: best?.category || 'Technology',
        icon: 'Sparkles',
        keywords: input.fields,
        careerKit: best?.careerKit || [],
      };
      await cacheSet(key, 'roadmap', roadmap, provider);
      logCall(user, 'roadmap', 'ai', { provider, latencyMs });
      return { source: 'ai', provider, draftKey: key, roadmap };
    } catch (err) {
      logCall(user, 'roadmap', 'library', { success: false, error: err.message, latencyMs: Date.now() - started });
      notice = 'Our AI assistants are busy right now, so we built this plan from our curated library.';
    }
  }

  // 5. Fallback — blend the best curated roadmaps for each requested field.
  const picked = matches.filter((m) => m.roadmap && m.score > 0).map((m) => m.roadmap);
  const chosen = picked.length ? picked : library.filter((r) => r.slug === 'full-stack-web-development' || r.slug === 'data-analytics').slice(0, 1);
  if (chosen.length === 1) {
    return { source: 'library', notice, libraryRoadmap: chosen[0], roadmap: chosen[0] };
  }
  const blended = blendRoadmaps(chosen, input);
  const blendKey = `blend:v1:${sha256(JSON.stringify(input))}`;
  await cacheSet(blendKey, 'roadmap', blended, 'library-blend', 7);
  return { source: 'library', notice, draftKey: blendKey, roadmap: blended };
}

export async function loadDraft(draftKey) {
  const hit = await AiCache.findOne({ key: draftKey, expiresAt: { $gt: new Date() } }).lean();
  return hit ? { roadmap: hit.payload, provider: hit.provider } : null;
}

// ---------------------------------------------------------------- counsellor chat
const CHAT_SYSTEM = `You are "Saathi", a warm, practical career counsellor for Indian college students on the CareerSaathi platform.
Answer in under 150 words with concrete next steps. Where useful, point to platform sections: Roadmap (career paths, Career Compass quiz),
Opportunities (jobs, internships, competitions, tracker), Connect (mentors, communities), Wellness (check-ins, breathing, focus timer),
Profile (resume builder, career kit). Do not invent salaries, company openings, statistics or links. You are not a doctor:
for emotional distress be supportive and mention Tele-MANAS (14416). Reply in the language the student uses.`;

export async function counsellorChat({ message, history = [] }, user) {
  const started = Date.now();
  if (isCrisis(message)) {
    logCall(user, 'chat', 'rules');
    return { source: 'rules', reply: CRISIS_RESPONSE };
  }

  const context = { degree: user.education?.degree || '', tracks: (user.careerTracks || []).slice(0, 3) };
  const cacheable = history.length === 0;
  const key = `chat:v1:${sha256(JSON.stringify({ m: message.trim().toLowerCase().replace(/\s+/g, ' '), ...context }))}`;

  if (cacheable) {
    const cached = await cacheGet(key);
    if (cached) {
      logCall(user, 'chat', 'cache', { provider: cached.provider });
      return { source: 'cache', provider: cached.provider, reply: cached.payload };
    }
  }

  const quota = await quotaState(user);
  if (quota.enabled && configuredProviders().length && quota.remaining > 0) {
    try {
      const { output, provider, latencyMs } = await runCompletion({
        system: `${CHAT_SYSTEM}\nStudent context: ${JSON.stringify(context)}`,
        messages: [...history.slice(-6), { role: 'user', content: message }],
        maxTokens: 400,
        temperature: 0.5,
      });
      if (cacheable) await cacheSet(key, 'chat', output, provider, 14);
      logCall(user, 'chat', 'ai', { provider, latencyMs });
      return { source: 'ai', provider, reply: output };
    } catch (err) {
      logCall(user, 'chat', 'rules', { success: false, error: err.message, latencyMs: Date.now() - started });
    }
  } else {
    logCall(user, 'chat', 'rules');
  }
  return {
    source: 'rules',
    reply: ruleBasedAnswer(message),
    notice: quota.remaining <= 0 && quota.enabled ? "You've reached today's AI limit — showing built-in guidance." : undefined,
  };
}

// ---------------------------------------------------------------- admin
export async function aiStatus() {
  const since = new Date(Date.now() - 24 * 3600_000);
  const [bySource, cacheEntries, settings] = await Promise.all([
    AiLog.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
    AiCache.countDocuments(),
    getSettings(),
  ]);
  const counts = Object.fromEntries(bySource.map((b) => [b._id, b.count]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const free = (counts.cache || 0) + (counts.library || 0) + (counts.rules || 0);
  return {
    enabled: settings.aiEnabled,
    order: getAiOrder(),
    providers: poolStatus(),
    last24h: { total, ...counts, savedByCacheOrLibraryPct: total ? Math.round((free / total) * 100) : 0 },
    cacheEntries,
    limits: { student: settings.aiDailyLimitStudent, staff: settings.aiDailyLimitStaff },
  };
}

export async function testProvider(provider) {
  if (!providers[provider]) throw new Error('Unknown provider');
  const started = Date.now();
  try {
    const { output } = await runCompletion({
      system: 'Reply with the single word OK.',
      messages: [{ role: 'user', content: 'ping' }],
      maxTokens: 5,
      temperature: 0,
      only: provider,
    });
    return { ok: true, reply: String(output).slice(0, 20), latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, error: err.message, latencyMs: Date.now() - started };
  }
}

export async function clearAiCache() {
  const { deletedCount } = await AiCache.deleteMany({});
  return deletedCount;
}

export async function getQuota(user) {
  return quotaState(user);
}
