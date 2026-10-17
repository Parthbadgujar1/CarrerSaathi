import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { WellnessLog } from '../../models/index.js';
import { ROLES } from '../../config/constants.js';
import { dayKey, addDays } from '../../utils/helpers.js';
import { encrypt, decrypt } from '../../services/crypto.service.js';
import { refreshReadiness } from '../../services/readiness.service.js';
import { WELLNESS_RESOURCES } from '../../data/careerData.js';
import { streakFrom } from '../students/students.controller.js';

const router = Router();
router.use(authenticate, authorize(ROLES.STUDENT));

router.get('/resources', (_req, res) => res.json({ success: true, data: WELLNESS_RESOURCES }));

router.get('/', validate({ query: z.object({ days: z.coerce.number().int().min(7).max(90).default(30) }) }), async (req, res) => {
  const since = dayKey(addDays(new Date(), -(req.query.days - 1)));
  const logs = await WellnessLog.find({ user: req.user._id, day: { $gte: since } }).sort({ day: 1 }).lean();
  const avg = (k) => {
    const vals = logs.map((l) => l[k]).filter((v) => typeof v === 'number');
    return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  };
  const recent = logs.slice(-3);
  const lowMoodStreak = recent.length === 3 && recent.every((l) => l.mood <= 2);
  const today = logs.find((l) => l.day === dayKey());
  const all = await WellnessLog.find({ user: req.user._id, day: { $gte: dayKey(addDays(new Date(), -120)) } }).select('day').lean();
  res.json({
    success: true,
    data: {
      logs: logs.map((l) => ({ ...l, journal: undefined, hasJournal: Boolean(l.journal) })),
      today: today ? { ...today, journal: decrypt(today.journal) || '' } : null,
      stats: {
        avgMood: avg('mood'),
        avgStress: avg('stress'),
        avgSleep: avg('sleepHours'),
        avgExercise: avg('exerciseMinutes'),
        avgWater: avg('waterGlasses'),
        checkins: logs.length,
        streak: streakFrom(all.map((l) => l.day)),
      },
      // Gentle, non-diagnostic nudge after three low days in a row.
      supportNudge: lowMoodStreak,
    },
  });
});

const checkinSchema = z.object({
  mood: z.coerce.number().int().min(1).max(5),
  stress: z.coerce.number().int().min(1).max(5).optional(),
  sleepHours: z.coerce.number().min(0).max(24).optional(),
  exerciseMinutes: z.coerce.number().int().min(0).max(600).optional(),
  waterGlasses: z.coerce.number().int().min(0).max(30).optional(),
  screenHours: z.coerce.number().min(0).max(24).optional(),
  journal: z.string().trim().max(2000).optional().default(''),
});

router.put('/today', validate({ body: checkinSchema }), async (req, res) => {
  const day = dayKey();
  const { journal, ...rest } = req.body;
  const log = await WellnessLog.findOneAndUpdate(
    { user: req.user._id, day },
    { $set: { ...rest, journal: journal ? encrypt(journal) : '' } },
    { upsert: true, new: true, runValidators: true },
  ).lean();
  refreshReadiness(req.user._id);
  res.json({ success: true, data: { ...log, journal }, message: 'Check-in saved. Thanks for taking care of yourself!' });
});

export default router;
