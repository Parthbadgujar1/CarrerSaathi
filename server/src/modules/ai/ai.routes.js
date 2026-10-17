import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { aiLimiter } from '../../middleware/rateLimiters.js';
import { text } from '../../utils/schemas.js';
import { counsellorChat, getQuota } from '../../services/ai/ai.service.js';

const router = Router();
router.use(authenticate);

const chatSchema = z.object({
  message: text(1000, 1),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) }))
    .max(10)
    .default([]),
});

router.post('/chat', aiLimiter, validate({ body: chatSchema }), async (req, res) => {
  const result = await counsellorChat(req.body, req.user);
  res.json({ success: true, data: result });
});

router.get('/quota', async (req, res) => {
  const q = await getQuota(req.user);
  res.json({ success: true, data: q });
});

export default router;
