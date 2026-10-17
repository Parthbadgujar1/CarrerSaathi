import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { contactLimiter } from '../../middleware/rateLimiters.js';
import { optionalAuth } from '../../middleware/auth.js';
import { ContactMessage, Roadmap, Opportunity, Community, User } from '../../models/index.js';
import { email, name, text } from '../../utils/schemas.js';
import { escapeRegex } from '../../utils/helpers.js';
import { ROLES, USER_STATUS } from '../../config/constants.js';
import { getSettings } from '../../services/settings.service.js';
import { notify } from '../../services/notification.service.js';

const router = Router();

/** Real numbers only — no inflated marketing counters. */
router.get('/stats', async (_req, res) => {
  const [roadmaps, mentors, opportunities, communities] = await Promise.all([
    Roadmap.countDocuments({ isPublished: true, owner: null }),
    User.countDocuments({ role: ROLES.MENTOR, status: USER_STATUS.ACTIVE }),
    Opportunity.countDocuments({ status: 'active', $or: [{ deadline: null }, { deadline: { $gte: new Date() } }] }),
    Community.countDocuments({ status: 'active' }),
  ]);
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ success: true, data: { roadmaps, mentors, opportunities, communities } });
});

router.get('/config', async (_req, res) => {
  const s = await getSettings();
  res.json({
    success: true,
    data: { registrationOpen: s.registrationOpen, mentorApplicationsOpen: s.mentorApplicationsOpen, announcementBanner: s.announcementBanner },
  });
});

const contactSchema = z.object({
  name,
  email,
  subject: text(140).optional().default(''),
  message: text(3000, 10),
  consent: z.literal(true, { error: 'Please agree so we can use your details to reply' }),
  website: z.string().max(200).optional().default(''), // honeypot: humans never fill this hidden field
});

const CONTACT_OK = "Thanks for reaching out! We'll reply within 2 working days.";

router.post('/contact', contactLimiter, validate({ body: contactSchema }), async (req, res) => {
  const { website, consent, ...data } = req.body;
  // Bots fill the hidden field — pretend success so they learn nothing, but store nothing.
  if (website) return res.status(201).json({ success: true, message: CONTACT_OK });
  const msg = await ContactMessage.create(data);
  const admins = await User.find({ role: ROLES.ADMIN, status: USER_STATUS.ACTIVE }).select('_id').lean();
  notify(admins.map((a) => a._id), { type: 'contact', title: 'New contact message', body: `${msg.name}: ${msg.subject || msg.message.slice(0, 80)}`, link: '/admin/system?tab=inbox' });
  res.status(201).json({ success: true, message: CONTACT_OK });
});

/** Unified site search: public results for guests, more for signed-in users. */
router.get('/search', optionalAuth, validate({ query: z.object({ q: text(80, 2) }) }), async (req, res) => {
  const rx = new RegExp(escapeRegex(req.query.q), 'i');
  const tasks = [
    Roadmap.find({ isPublished: true, owner: null, $or: [{ title: rx }, { keywords: rx }, { roles: rx }] }).select('title slug category').limit(6).lean(),
  ];
  if (req.user) {
    tasks.push(
      Opportunity.find({ status: 'active', $or: [{ title: rx }, { organization: rx }] }).select('title organization type').limit(5).lean(),
      Community.find({ status: 'active', $or: [{ name: rx }, { tags: rx }] }).select('name memberCount').limit(5).lean(),
    );
  }
  const [roadmaps, opportunities = [], communities = []] = await Promise.all(tasks);
  res.json({ success: true, data: { roadmaps, opportunities, communities } });
});

export default router;
