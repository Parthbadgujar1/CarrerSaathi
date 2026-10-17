import { z } from 'zod';
import { User, Enrollment, Meeting, Opportunity, Mentorship, WellnessLog, Notification, MentorNote } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { dayKey, addDays } from '../../utils/helpers.js';
import { text, optionalUrl } from '../../utils/schemas.js';
import { computeReadiness, getCareerKitItems, refreshReadiness } from '../../services/readiness.service.js';
import { meetingVisibilityFilter } from '../meetings/meetings.service.js';
import { getSettings } from '../../services/settings.service.js';

/** Consecutive days (ending today or yesterday) that appear in a set of YYYY-MM-DD keys. */
export function streakFrom(days) {
  const set = new Set(days);
  let streak = 0;
  let cursor = new Date();
  if (!set.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  while (set.has(dayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export async function dashboard(req, res) {
  const user = req.user;
  const today = dayKey();
  const visibility = await meetingVisibilityFilter(user);

  const [readiness, enrollments, meetings, opportunities, mentorships, todayLog, recentLogs, unread, goals, settings] = await Promise.all([
    computeReadiness(user._id),
    Enrollment.find({ user: user._id }).populate('roadmap', 'title slug icon category phases').sort({ lastActivityAt: -1 }).lean(),
    Meeting.find({ ...visibility, status: 'scheduled', startAt: { $gte: addDays(new Date(), -0.05) } })
      .sort({ startAt: 1 })
      .limit(3)
      .populate('host', 'name')
      .lean(),
    Opportunity.find({
      status: 'active',
      $and: [
        { $or: [{ deadline: null }, { deadline: { $gte: new Date() } }] },
        ...(user.careerTracks?.length ? [{ $or: [{ tracks: { $in: user.careerTracks } }, { tracks: { $size: 0 } }] }] : []),
      ],
    })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean(),
    Mentorship.find({ student: user._id, status: 'active' }).populate('mentor', 'name mentorProfile.designation mentorProfile.company').lean(),
    WellnessLog.findOne({ user: user._id, day: today }).select('mood day').lean(),
    WellnessLog.find({ user: user._id, day: { $gte: dayKey(addDays(new Date(), -60)) } }).select('day').lean(),
    Notification.countDocuments({ user: user._id, readAt: null }),
    MentorNote.find({ student: user._id, type: 'goal', visibleToStudent: true, done: false }).sort({ createdAt: -1 }).limit(3).populate('mentor', 'name').lean(),
    getSettings(),
  ]);

  if (readiness && readiness.score !== user.readinessScore) {
    User.updateOne({ _id: user._id }, { readinessScore: readiness.score }).catch(() => {});
  }

  // Next steps from the most recently active roadmap.
  const nextSteps = [];
  for (const e of enrollments) {
    if (!e.roadmap || e.status === 'completed') continue;
    const done = new Set(e.completed.map((c) => c.key));
    for (const phase of e.roadmap.phases) {
      for (const step of phase.steps) {
        if (!done.has(step.key) && nextSteps.length < 3) {
          nextSteps.push({ roadmapId: e.roadmap._id, roadmapTitle: e.roadmap.title, slug: e.roadmap.slug, phase: phase.title, key: step.key, title: step.title });
        }
      }
    }
    if (nextSteps.length >= 3) break;
  }

  const learningDays = enrollments.flatMap((e) => e.completed.map((c) => dayKey(new Date(c.at))));

  res.json({
    success: true,
    data: {
      readiness,
      enrollments: enrollments.map((e) => ({
        _id: e._id,
        progress: e.progress,
        status: e.status,
        lastActivityAt: e.lastActivityAt,
        roadmap: e.roadmap && { _id: e.roadmap._id, title: e.roadmap.title, slug: e.roadmap.slug, icon: e.roadmap.icon, category: e.roadmap.category },
      })),
      nextSteps,
      meetings,
      opportunities,
      mentors: mentorships.map((m) => m.mentor).filter(Boolean),
      goals,
      wellness: { checkedInToday: Boolean(todayLog), mood: todayLog?.mood, streak: streakFrom(recentLogs.map((l) => l.day)) },
      learningStreak: streakFrom(learningDays),
      unreadNotifications: unread,
      announcement: settings.announcementBanner || '',
    },
  });
}

export async function getCareerKit(req, res) {
  const readiness = await computeReadiness(req.user._id);
  res.json({ success: true, data: { kit: readiness.kit, readiness: { score: readiness.score, breakdown: readiness.breakdown } } });
}

export const careerKitSchema = z.object({ items: z.record(z.string().max(60), z.boolean()) });

export async function updateCareerKit(req, res) {
  const allowed = new Set((await getCareerKitItems(req.user._id)).map((i) => i.key));
  const set = {};
  for (const [key, value] of Object.entries(req.body.items)) {
    if (!allowed.has(key)) throw ApiError.badRequest(`Unknown checklist item: ${key}`);
    set[`careerKit.${key}`] = value;
  }
  await User.updateOne({ _id: req.user._id }, { $set: set });
  const result = await refreshReadiness(req.user._id);
  res.json({ success: true, data: { kit: result.kit, readiness: { score: result.score, breakdown: result.breakdown } } });
}

const shortText = (n) => text(n).optional().default('');
export const resumeSchema = z.object({
  summary: text(1200).optional().default(''),
  experience: z
    .array(z.object({ title: shortText(120), organization: shortText(120), start: shortText(20), end: shortText(20), description: shortText(1000) }))
    .max(10)
    .default([]),
  projects: z
    .array(z.object({ name: shortText(120), link: optionalUrl.default(''), tech: shortText(200), description: shortText(1000) }))
    .max(10)
    .default([]),
  certifications: z
    .array(z.object({ name: shortText(160), issuer: shortText(120), year: shortText(10), link: optionalUrl.default('') }))
    .max(15)
    .default([]),
  achievements: z.array(text(300)).max(15).default([]),
});

export async function getResume(req, res) {
  const user = await User.findById(req.user._id).select('name email phone headline education address skills links resume careerTracks');
  res.json({ success: true, data: { user } });
}

export async function updateResume(req, res) {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { resume: { ...req.body, updatedAt: new Date() } } },
    { new: true, runValidators: true },
  ).select('name email phone headline education address skills links resume careerTracks');
  res.json({ success: true, data: { user }, message: 'Resume saved.' });
}

export async function myMentorNotes(req, res) {
  const notes = await MentorNote.find({ student: req.user._id, visibleToStudent: true })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('mentor', 'name')
    .lean();
  res.json({ success: true, data: notes });
}
