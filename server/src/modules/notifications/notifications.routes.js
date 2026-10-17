import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { Notification } from '../../models/index.js';
import { objectId } from '../../utils/schemas.js';

const router = Router();
router.use(authenticate);

router.get('/', validate({ query: z.object({ unread: z.enum(['true', 'false']).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }) }), async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.unread === 'true') filter.readAt = null;
  const [items, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(req.query.limit).lean(),
    Notification.countDocuments({ user: req.user._id, readAt: null }),
  ]);
  res.json({ success: true, data: { items, unread } });
});

router.get('/unread-count', async (req, res) => {
  res.json({ success: true, data: { unread: await Notification.countDocuments({ user: req.user._id, readAt: null }) } });
});

router.post('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, readAt: null }, { readAt: new Date() });
  res.json({ success: true });
});

router.post('/:id/read', validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { readAt: new Date() });
  res.json({ success: true });
});

export default router;
