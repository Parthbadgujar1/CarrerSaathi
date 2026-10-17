/**
 * Idempotent startup bootstrap:
 *  - installs any missing built-in roadmaps (never overwrites admin edits)
 *  - creates the first admin from SEED_ADMIN_* env vars if no admin exists
 *  - creates official starter communities if there are none
 */
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ROADMAPS } from '../data/roadmaps.js';
import { Roadmap, User, Community, Conversation } from '../models/index.js';
import { ROLES, USER_STATUS, LEGAL_VERSIONS } from '../config/constants.js';
import { randomToken } from '../utils/helpers.js';

export const STARTER_COMMUNITIES = [
  { name: 'Web Dev Circle', track: 'full-stack-web-development', description: 'Frontend, backend and full stack — share projects, doubts and resources.', tags: ['react', 'node', 'web'] },
  { name: 'Data & AI Hub', track: 'data-science-ai', description: 'Machine learning, analytics, Kaggle and GenAI discussions.', tags: ['ml', 'python', 'ai'] },
  { name: 'Core Engineers', track: 'mechanical-engineering-design', description: 'Mechanical, civil and electrical students preparing for core jobs and GATE.', tags: ['core', 'gate', 'psu'] },
  { name: 'Design Studio', track: 'ui-ux-design', description: 'UI/UX critiques, Figma tips and portfolio reviews.', tags: ['design', 'figma'] },
  { name: 'Management & HR Lounge', track: 'human-resources', description: 'HR, marketing, consulting and product management careers.', tags: ['mba', 'hr', 'marketing'] },
  { name: 'Finance Forum', track: 'finance-accounting', description: 'Accounting, banking, markets and finance interview prep.', tags: ['finance', 'banking'] },
  { name: 'Placement Prep', track: '', description: 'Aptitude, interviews, resumes and placement experiences.', tags: ['placements', 'interviews'] },
  { name: 'Wellness Corner', track: '', description: 'A kind space to talk about balance, stress and staying healthy. Be supportive.', tags: ['wellbeing'] },
];

export async function ensureLibrary() {
  const existing = new Set((await Roadmap.find({ slug: { $in: ROADMAPS.map((r) => r.slug) } }).select('slug').lean()).map((r) => r.slug));
  const missing = ROADMAPS.filter((r) => !existing.has(r.slug));
  if (missing.length) {
    await Roadmap.insertMany(missing.map((r) => ({ ...r, source: 'system', isPublished: true })));
    logger.info(`Installed ${missing.length} built-in roadmap(s)`);
  }

  let admin = await User.findOne({ role: ROLES.ADMIN }).select('_id').lean();
  if (!admin && env.SEED_ADMIN_EMAIL && env.SEED_ADMIN_PASSWORD) {
    admin = await User.create({
      name: env.SEED_ADMIN_NAME,
      email: env.SEED_ADMIN_EMAIL.toLowerCase(),
      password: env.SEED_ADMIN_PASSWORD,
      role: ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
      emailVerified: true,
      consents: { termsVersion: LEGAL_VERSIONS.terms, privacyVersion: LEGAL_VERSIONS.privacy, acceptedAt: new Date() },
      unsubscribeToken: randomToken(24),
    });
    logger.info(`Created initial admin account (${env.SEED_ADMIN_EMAIL})`);
  }

  if (admin && !(await Community.exists({}))) {
    for (const c of STARTER_COMMUNITIES) {
      const community = await Community.create({ ...c, slug: c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), isOfficial: true, createdBy: admin._id, memberCount: 0 });
      const convo = await Conversation.create({ type: 'community', community: community._id, lastMessageAt: new Date() });
      community.conversation = convo._id;
      await community.save();
    }
    logger.info('Created starter communities');
  }
  return { installedRoadmaps: missing.length };
}
