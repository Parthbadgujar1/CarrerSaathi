import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { sensitiveLimiter } from '../../middleware/rateLimiters.js';
import { idParam } from '../../utils/schemas.js';
import * as c from './users.controller.js';
import * as v from './users.validation.js';

const router = Router();

router.post('/unsubscribe', sensitiveLimiter, validate({ body: v.unsubscribeSchema }), c.unsubscribe);

router.use(authenticate);
router.patch('/me', validate({ body: v.updateProfileSchema }), c.updateProfile);
router.patch('/me/preferences', validate({ body: v.preferencesSchema }), c.updatePreferences);
router.get('/me/sessions', c.listSessions);
router.delete('/me/sessions/:id', validate({ params: idParam }), c.revokeOneSession);
router.get('/me/export', sensitiveLimiter, c.exportData);
router.post('/me/deletion', sensitiveLimiter, validate({ body: v.deletionSchema }), c.requestDeletion);

export default router;
