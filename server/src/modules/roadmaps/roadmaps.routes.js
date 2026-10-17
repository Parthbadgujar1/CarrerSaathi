import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize, optionalAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { aiLimiter } from '../../middleware/rateLimiters.js';
import { ROLES } from '../../config/constants.js';
import * as c from './roadmaps.controller.js';

const router = Router();
const slugParam = z.object({ slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/i) });

// Public library (also used by the marketing site)
router.get('/', validate({ query: c.listQuery }), c.list);
router.get('/quiz', c.quiz);

// Authenticated
router.get('/me/enrollments', authenticate, c.myEnrollments);
router.post('/recommend', authenticate, validate({ body: c.recommendSchema }), c.recommend);
router.post('/generate', authenticate, aiLimiter, validate({ body: c.generateSchema }), c.generate);
router.post('/save-draft', authenticate, authorize(ROLES.STUDENT), validate({ body: c.saveDraftSchema }), c.saveDraft);
router.post('/:id/enroll', authenticate, authorize(ROLES.STUDENT), validate({ params: c.idSchema }), c.enroll);
router.delete('/:id/enroll', authenticate, authorize(ROLES.STUDENT), validate({ params: c.idSchema }), c.unenroll);
router.patch('/:id/steps', authenticate, authorize(ROLES.STUDENT), validate({ params: c.idSchema, body: c.stepSchema }), c.toggleStep);

// Admin management
router.get('/admin/all', authenticate, authorize(ROLES.ADMIN), c.adminList);
router.post('/admin/bulk', authenticate, authorize(ROLES.ADMIN), validate({ body: c.bulkSchema }), c.adminBulk);
router.post('/admin', authenticate, authorize(ROLES.ADMIN), validate({ body: c.roadmapBodySchema }), c.adminCreate);
router.put('/admin/:id', authenticate, authorize(ROLES.ADMIN), validate({ params: c.idSchema, body: c.roadmapBodySchema }), c.adminUpdate);
router.delete('/admin/:id', authenticate, authorize(ROLES.ADMIN), validate({ params: c.idSchema }), c.adminDelete);

// Detail — guests can browse; signed-in students also get progress + skill gap.
router.get('/:slug', optionalAuth, validate({ params: slugParam }), c.getOne);

export default router;
