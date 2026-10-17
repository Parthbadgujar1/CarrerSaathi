/**
 * In-process background jobs. Each job is isolated: an error is logged and
 * the job simply runs again next tick — it can never crash the API.
 */
import { logger } from '../config/logger.js';
import { isDbReady } from '../config/db.js';
import { User, Meeting, Opportunity, DeletionRequest, Attempt, Test } from '../models/index.js';
import { audienceUserFilter, finalizeAttempt, GRACE_MS } from '../modules/tests/tests.service.js';
import { USER_STATUS } from '../config/constants.js';
import { processOutbox, recoverStuckEmails } from '../services/email/email.service.js';
import { purgeUser } from '../services/userData.service.js';
import { sendEmail } from '../services/email/email.service.js';
import { notify } from '../services/notification.service.js';

const timers = [];

function every(name, ms, fn, { runAtStart = false } = {}) {
  let running = false;
  const run = async () => {
    if (running || !isDbReady()) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      logger.error(`Job "${name}" failed`, { message: err.message });
    } finally {
      running = false;
    }
  };
  const t = setInterval(run, ms);
  t.unref();
  timers.push(t);
  if (runAtStart) setTimeout(run, 5_000).unref();
}

/** Accounts whose deletion grace period has ended are permanently erased. */
async function purgeScheduledDeletions() {
  const due = await User.find({ status: USER_STATUS.DELETION_PENDING, 'deletion.scheduledFor': { $lte: new Date() } }).select('_id').limit(50).lean();
  for (const u of due) {
    const purged = await purgeUser(u._id);
    await DeletionRequest.updateMany({ user: u._id, status: 'pending' }, { status: 'completed', processedAt: new Date() });
    if (purged) await sendEmail(purged.email, 'deletionCompleted', { name: purged.name });
  }
  if (due.length) logger.info(`Purged ${due.length} account(s) after deletion grace period`);
}

/** In-app reminder ~1 hour before sessions start. */
async function meetingReminders() {
  const soon = new Date(Date.now() + 60 * 60_000);
  const meetings = await Meeting.find({ status: 'scheduled', reminderSent: false, startAt: { $lte: soon, $gte: new Date() } }).limit(50);
  for (const m of meetings) {
    await notify([...m.attendees, m.host], { type: 'meeting', title: `Starting soon: ${m.title}`, body: 'Your session begins within the hour.', link: `/meet/${m._id}` });
    m.reminderSent = true;
    await m.save();
  }
}

/** Closes and grades test attempts whose time ran out (browser closed, laptop died…). */
async function autoSubmitExpired() {
  const stale = await Attempt.find({ status: 'in_progress', deadline: { $lt: new Date(Date.now() - GRACE_MS) } }).select('_id').limit(200).lean();
  for (const a of stale) await finalizeAttempt(a._id, { auto: true });
  if (stale.length) logger.info(`Auto-submitted ${stale.length} expired test attempt(s)`);
}

/** Reminder to assigned students about an hour before a test opens. */
async function testReminders() {
  const soon = new Date(Date.now() + 60 * 60_000);
  const tests = await Test.find({ status: 'published', reminderSent: false, startAt: { $lte: soon, $gte: new Date() } }).limit(20);
  for (const t of tests) {
    const ids = (await User.find(audienceUserFilter(t.audience)).select('_id').limit(10_000).lean()).map((u) => u._id);
    await notify(ids, { type: 'test', title: `Test starting soon: ${t.title}`, body: `Opens within the hour · ${t.durationMinutes} min`, link: '/app/tests' });
    t.reminderSent = true;
    await t.save();
  }
}

async function housekeeping() {
  const now = new Date();
  await Opportunity.updateMany({ status: 'active', deadline: { $lt: now } }, { status: 'closed' });
  await Meeting.updateMany(
    { status: 'scheduled', startAt: { $lt: new Date(now.getTime() - 8 * 3600_000) } },
    { status: 'completed' },
  );
  await recoverStuckEmails();
}

export function startJobs() {
  every('email-outbox', 30_000, () => processOutbox(20), { runAtStart: true });
  every('meeting-reminders', 5 * 60_000, meetingReminders, { runAtStart: true });
  every('deletion-purge', 60 * 60_000, purgeScheduledDeletions, { runAtStart: true });
  every('test-autosubmit', 60_000, autoSubmitExpired, { runAtStart: true });
  every('test-reminders', 5 * 60_000, testReminders, { runAtStart: true });
  every('housekeeping', 60 * 60_000, housekeeping, { runAtStart: true });
  logger.info('Background jobs scheduled');
}

export function stopJobs() {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
}
