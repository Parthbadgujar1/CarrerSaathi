import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { objectId, text } from '../../utils/schemas.js';
import * as chat from './chat.service.js';

const router = Router();
router.use(authenticate);

const idParam = z.object({ id: objectId });

router.get('/conversations', async (req, res) => {
  res.json({ success: true, data: await chat.listConversations(req.user) });
});

router.post('/direct', validate({ body: z.object({ userId: objectId }) }), async (req, res) => {
  res.json({ success: true, data: await chat.getOrCreateDirect(req.user, req.body.userId) });
});

router.get(
  '/conversations/:id/messages',
  validate({ params: idParam, query: z.object({ before: z.iso.datetime().optional(), limit: z.coerce.number().int().min(1).max(100).optional() }) }),
  async (req, res) => {
    res.json({ success: true, data: await chat.listMessages(req.user, req.params.id, req.query) });
  },
);

// REST fallback for sending when the realtime socket is unavailable.
router.post('/conversations/:id/messages', validate({ params: idParam, body: z.object({ text: text(2000, 1) }) }), async (req, res) => {
  res.status(201).json({ success: true, data: await chat.sendMessage(req.user, req.params.id, req.body.text) });
});

router.post('/conversations/:id/read', validate({ params: idParam }), async (req, res) => {
  await chat.markRead(req.user, req.params.id);
  res.json({ success: true });
});

router.delete('/messages/:id', validate({ params: idParam }), async (req, res) => {
  await chat.deleteMessage(req.user, req.params.id);
  res.json({ success: true, message: 'Message deleted.' });
});

export default router;
