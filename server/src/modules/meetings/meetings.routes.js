import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../config/constants.js';
import * as c from './meetings.controller.js';

const router = Router();
router.use(authenticate);
const staff = authorize(ROLES.ADMIN, ROLES.MENTOR);

router.get('/', validate({ query: c.listQuery }), c.list);
router.get('/:id', validate({ params: c.idSchema }), c.getOne);
router.post('/', staff, validate({ body: c.bodySchema }), c.create);
router.put('/:id', staff, validate({ params: c.idSchema, body: c.bodySchema }), c.update);
router.post('/:id/cancel', staff, validate({ params: c.idSchema }), c.cancel);
router.post('/:id/rsvp', validate({ params: c.idSchema, body: c.rsvpSchema }), c.rsvp);

export default router;
