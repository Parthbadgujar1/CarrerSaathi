/**
 * Industry Readiness Score (0–100) — a transparent, explainable score that
 * shows students exactly what to improve. Weights:
 *   Profile 20 · Career kit 30 · Roadmap progress 35 · Engagement 15
 */
import { User, Enrollment, WellnessLog, Application, Mentorship, Roadmap } from '../models/index.js';
import { CORE_CAREER_KIT } from '../data/careerData.js';
import { logger } from '../config/logger.js';
import { dayKey, addDays } from '../utils/helpers.js';

/** Core kit + track-specific kit items from the student's enrolled roadmaps. */
export async function getCareerKitItems(userId) {
  const enrollments = await Enrollment.find({ user: userId }).select('roadmap').lean();
  const roadmaps = await Roadmap.find({ _id: { $in: enrollments.map((e) => e.roadmap) } })
    .select('careerKit title')
    .lean();
  const items = [...CORE_CAREER_KIT.map((i) => ({ ...i, track: 'Core' }))];
  const seen = new Set(items.map((i) => i.key));
  for (const r of roadmaps) {
    for (const item of r.careerKit || []) {
      if (!seen.has(item.key)) {
        seen.add(item.key);
        items.push({ key: item.key, label: item.label, track: r.title });
      }
    }
  }
  return items;
}

export async function computeReadiness(userId) {
  const user = await User.findById(userId).lean();
  if (!user) return null;

  // Profile (20)
  const profileChecks = [
    Boolean(user.phone),
    Boolean(user.education?.college),
    Boolean(user.education?.degree),
    Boolean(user.education?.graduationYear),
    Boolean(user.headline || user.bio),
    (user.skills || []).length >= 3,
    (user.careerTracks || []).length >= 1,
    Boolean(user.links?.linkedin),
  ];
  const profile = Math.round((profileChecks.filter(Boolean).length / profileChecks.length) * 20);

  // Career kit (30)
  const kitItems = await getCareerKitItems(userId);
  const kitMap = user.careerKit || {};
  const kitDone = kitItems.filter((i) => kitMap[i.key] === true).length;
  const careerKit = kitItems.length ? Math.round((kitDone / kitItems.length) * 30) : 0;

  // Roadmap progress (35) — best active roadmap counts most, others add a little.
  const enrollments = await Enrollment.find({ user: userId }).select('progress').lean();
  const progresses = enrollments.map((e) => e.progress || 0).sort((a, b) => b - a);
  const roadmapPct = progresses.length ? Math.min(100, progresses[0] + progresses.slice(1).reduce((s, p) => s + p * 0.1, 0)) : 0;
  const roadmap = Math.round((roadmapPct / 100) * 35);

  // Engagement (15)
  const since = dayKey(addDays(new Date(), -6));
  const [checkins, applications, mentor] = await Promise.all([
    WellnessLog.countDocuments({ user: userId, day: { $gte: since } }),
    Application.countDocuments({ user: userId, status: { $in: ['applied', 'interview', 'offer'] } }),
    Mentorship.exists({ student: userId, status: 'active' }),
  ]);
  const engagement = Math.min(5, checkins) + Math.min(5, applications) + (mentor ? 5 : 0);

  const score = Math.min(100, profile + careerKit + roadmap + engagement);
  return {
    score,
    breakdown: [
      { key: 'profile', label: 'Profile', score: profile, max: 20 },
      { key: 'careerKit', label: 'Career kit', score: careerKit, max: 30 },
      { key: 'roadmap', label: 'Roadmap progress', score: roadmap, max: 35 },
      { key: 'engagement', label: 'Consistency', score: engagement, max: 15 },
    ],
    kit: { items: kitItems.map((i) => ({ ...i, done: kitMap[i.key] === true })), done: kitDone, total: kitItems.length },
  };
}

/** Recomputes and stores the score. Fire-and-forget safe. */
export async function refreshReadiness(userId) {
  try {
    const result = await computeReadiness(userId);
    if (result) await User.updateOne({ _id: userId }, { readinessScore: result.score });
    return result;
  } catch (err) {
    logger.warn('Readiness recompute failed', { userId: String(userId), message: err.message });
    return null;
  }
}
