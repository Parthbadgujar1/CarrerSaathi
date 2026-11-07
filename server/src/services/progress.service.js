/**
 * Activity & progress over a chosen period (weekly / fortnightly / monthly), used by the
 * student dashboard and the admin overview. Everything is bucketed by IST calendar day so
 * the charts, rings and calendar all agree with the daily wellness check-in "day" keys.
 */
import { Application, Enrollment, User, WellnessLog } from '../models/index.js';
import { ROLES } from '../config/constants.js';
import { addDays, dayKey } from '../utils/helpers.js';

export const PERIODS = { week: 7, fortnight: 14, month: 30 };
const TZ = 'Asia/Kolkata';

/** YYYY-MM-DD keys for the `days` days ending today (oldest first). */
function dayKeys(days, endOffset = 0) {
  const now = new Date();
  return Array.from({ length: days }, (_, i) => dayKey(addDays(now, -(days - 1 - i) - endOffset)));
}

const emptyDay = (date) => ({ date, steps: 0, checkins: 0, applications: 0, registrations: 0, activeUsers: 0, total: 0 });

function summarise(days) {
  const totals = days.reduce(
    (t, d) => ({
      steps: t.steps + d.steps,
      checkins: t.checkins + d.checkins,
      applications: t.applications + d.applications,
      registrations: t.registrations + d.registrations,
      total: t.total + d.total,
    }),
    { steps: 0, checkins: 0, applications: 0, registrations: 0, total: 0 },
  );
  const activeDays = days.filter((d) => d.total > 0).length;
  let bestStreak = 0;
  let run = 0;
  for (const d of days) {
    run = d.total > 0 ? run + 1 : 0;
    bestStreak = Math.max(bestStreak, run);
  }
  return { ...totals, activeDays, bestStreak, periodDays: days.length };
}

function build(days, rows) {
  const map = new Map(days.map((d) => [d, emptyDay(d)]));
  for (const r of rows) {
    const cell = map.get(r.date);
    if (!cell) continue;
    cell[r.kind] += r.count;
    if (r.kind !== 'registrations') cell.total += r.count;
    if (r.activeUsers) cell.activeUsers = Math.max(cell.activeUsers, r.activeUsers);
  }
  return [...map.values()];
}

/** One student's own activity (steps completed, check-ins, application updates). */
export async function studentProgress(userId, period = 'week') {
  const n = PERIODS[period] || PERIODS.week;
  const current = dayKeys(n);
  const previous = dayKeys(n, n);
  const since = addDays(new Date(), -(n * 2 + 1));

  const [enrollments, logs, apps] = await Promise.all([
    Enrollment.find({ user: userId }).select('completed').lean(),
    WellnessLog.find({ user: userId, day: { $gte: previous[0] } }).select('day').lean(),
    Application.find({ user: userId, updatedAt: { $gte: since } }).select('updatedAt').lean(),
  ]);

  const rows = [];
  for (const e of enrollments) for (const c of e.completed || []) if (c.at) rows.push({ date: dayKey(c.at), kind: 'steps', count: 1 });
  for (const l of logs) rows.push({ date: l.day, kind: 'checkins', count: 1 });
  for (const a of apps) rows.push({ date: dayKey(a.updatedAt), kind: 'applications', count: 1 });

  const days = build(current, rows);
  return { period, days, summary: summarise(days), previous: summarise(build(previous, rows)) };
}

const bucketByDay = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ } });

/** Platform-wide student activity for admins. */
export async function platformProgress(period = 'week') {
  const n = PERIODS[period] || PERIODS.week;
  const current = dayKeys(n);
  const previous = dayKeys(n, n);
  const since = addDays(new Date(), -(n * 2 + 1));

  const [steps, checkins, applications, registrations] = await Promise.all([
    Enrollment.aggregate([
      { $unwind: '$completed' },
      { $match: { 'completed.at': { $gte: since } } },
      { $group: { _id: { date: bucketByDay('$completed.at'), user: '$user' }, c: { $sum: 1 } } },
      { $group: { _id: '$_id.date', count: { $sum: '$c' }, users: { $sum: 1 } } },
    ]),
    WellnessLog.aggregate([
      { $match: { day: { $gte: previous[0] } } },
      { $group: { _id: '$day', count: { $sum: 1 }, users: { $addToSet: '$user' } } },
    ]),
    Application.aggregate([
      { $match: { updatedAt: { $gte: since } } },
      { $group: { _id: bucketByDay('$updatedAt'), count: { $sum: 1 } } },
    ]),
    User.aggregate([
      { $match: { role: ROLES.STUDENT, createdAt: { $gte: since } } },
      { $group: { _id: bucketByDay('$createdAt'), count: { $sum: 1 } } },
    ]),
  ]);

  const rows = [
    ...steps.map((r) => ({ date: r._id, kind: 'steps', count: r.count, activeUsers: r.users })),
    ...checkins.map((r) => ({ date: r._id, kind: 'checkins', count: r.count, activeUsers: r.users.length })),
    ...applications.map((r) => ({ date: r._id, kind: 'applications', count: r.count })),
    ...registrations.map((r) => ({ date: r._id, kind: 'registrations', count: r.count })),
  ];
  const days = build(current, rows);
  return { period, days, summary: summarise(days), previous: summarise(build(previous, rows)) };
}
