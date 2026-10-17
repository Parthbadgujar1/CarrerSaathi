/**
 * Deterministic, zero-cost engines used before and after the AI providers:
 *  - library matching (serve a curated roadmap instead of calling an LLM)
 *  - multi-field blending (combine curated roadmaps when AI is unavailable)
 *  - rule-based counsellor answers
 *  - Career Compass quiz scoring
 */
import { COUNSELLOR_RULES, CRISIS_PATTERNS, CRISIS_RESPONSE, QUIZ } from '../../data/careerData.js';

const tokens = (s) =>
  String(s || '')
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((t) => t.length > 1);

/** Scores how well a free-text career field matches a roadmap. */
export function scoreRoadmap(field, roadmap) {
  const f = String(field || '').toLowerCase().trim();
  if (!f) return 0;
  let score = 0;
  const keywords = (roadmap.keywords || []).map((k) => k.toLowerCase());
  if (keywords.includes(f)) score += 10;
  if (roadmap.title.toLowerCase().includes(f) || f.includes(roadmap.title.toLowerCase())) score += 8;
  for (const k of keywords) {
    if (k !== f && k.length > 2 && (f.includes(k) || k.includes(f))) {
      score += 6;
      break;
    }
  }
  const haystack = new Set([
    ...tokens(roadmap.title),
    ...keywords.flatMap(tokens),
    ...(roadmap.roles || []).flatMap(tokens),
    ...(roadmap.skills || []).flatMap(tokens),
  ]);
  for (const t of tokens(f)) if (haystack.has(t)) score += 2;
  return score;
}

export function matchLibrary(fields, roadmaps) {
  return fields.map((field) => {
    let best = null;
    let bestScore = 0;
    for (const r of roadmaps) {
      const s = scoreRoadmap(field, r);
      if (s > bestScore) {
        best = r;
        bestScore = s;
      }
    }
    return { field, roadmap: best, score: bestScore, strong: bestScore >= 6 };
  });
}

/** Combines several curated roadmaps into one plan by interleaving their phases. */
export function blendRoadmaps(roadmaps, input) {
  const unique = [...new Map(roadmaps.map((r) => [String(r._id || r.slug), r])).values()];
  if (unique.length === 1) return unique[0];
  const maxPhases = Math.max(...unique.map((r) => r.phases.length));
  const phases = [];
  for (let i = 0; i < maxPhases; i += 1) {
    for (const r of unique) {
      const phase = r.phases[i];
      if (!phase) continue;
      const prefix = r.slug.split('-').map((w) => w[0]).join('');
      phases.push({
        title: `${r.title.split(' ')[0]} · ${phase.title}`,
        duration: phase.duration,
        steps: phase.steps.map((s) => ({ ...s, key: `${prefix}-${s.key}` })),
      });
    }
  }
  return {
    title: unique.map((r) => r.title).join(' + '),
    category: unique[0].category,
    summary: `A combined plan covering ${unique.map((r) => r.title).join(', ')}${input?.goal ? ` — aimed at: ${input.goal}` : ''}.`,
    duration: 'Self-paced',
    icon: 'Layers',
    roles: [...new Set(unique.flatMap((r) => r.roles || []))].slice(0, 8),
    skills: [...new Set(unique.flatMap((r) => r.skills || []))].slice(0, 20),
    keywords: [...new Set(unique.flatMap((r) => r.keywords || []))].slice(0, 30),
    careerKit: unique.flatMap((r) => r.careerKit || []),
    phases,
  };
}

export const isCrisis = (text) => CRISIS_PATTERNS.some((re) => re.test(text || ''));

export function ruleBasedAnswer(message) {
  if (isCrisis(message)) return CRISIS_RESPONSE;
  const m = String(message || '').toLowerCase();
  const rule = COUNSELLOR_RULES.find((r) => r.match.some((k) => m.includes(k)));
  if (rule) return rule.answer;
  return 'Here is a reliable way to move forward: (1) pick or confirm your career track on the Roadmap page (take the Career Compass quiz if unsure), (2) complete a few roadmap steps each week, (3) tick off your Career Kit — resume, LinkedIn, projects, (4) apply to opportunities and track them, and (5) connect with a mentor for personal guidance. Ask me about resumes, LinkedIn, interviews, internships, placements or higher studies for specific tips.';
}

/** Career Compass: answers = { [questionId]: optionId }. Returns ranked slugs with reasons. */
export function scoreQuiz(answers, { degree = '' } = {}) {
  const totals = {};
  const reasons = {};
  for (const q of QUIZ) {
    const opt = q.options.find((o) => o.id === answers?.[q.id]);
    if (!opt) continue;
    for (const [slug, w] of Object.entries(opt.weights)) {
      totals[slug] = (totals[slug] || 0) + w;
      (reasons[slug] ||= []).push(opt.label);
    }
  }
  const d = degree.toLowerCase();
  if (d) {
    const boosts = [
      [/b\.?com|commerce|ca\b/, ['finance-accounting', 'data-analytics']],
      [/bba|bms|mba|management/, ['business-analysis-consulting', 'digital-marketing', 'human-resources', 'product-management']],
      [/mech|automobile|production/, ['mechanical-engineering-design']],
      [/civil|arch/, ['civil-engineering']],
      [/ece|eee|electr/, ['electronics-embedded-vlsi']],
      [/cse|it\b|bca|mca|computer|software/, ['full-stack-web-development', 'data-science-ai', 'cloud-devops']],
      [/des|fine art|bfa/, ['ui-ux-design']],
      [/ba\b|arts|english|journalism|mass/, ['content-technical-writing', 'government-public-sector']],
    ];
    for (const [re, slugs] of boosts) if (re.test(d)) for (const s of slugs) totals[s] = (totals[s] || 0) + 1;
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([slug, score]) => ({ slug, score, reasons: [...new Set(reasons[slug] || [])].slice(0, 3) }));
}
