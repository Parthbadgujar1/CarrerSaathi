import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../config/constants.js';
import * as c from './opportunities.controller.js';

const router = Router();
router.use(authenticate);

const staff = authorize(ROLES.ADMIN, ROLES.MENTOR);

router.get('/', validate({ query: c.listQuery }), c.list);
router.get('/external', c.external);
router.get('/manage', staff, validate({ query: c.listQuery }), c.manageList);
router.get('/applications/me', authorize(ROLES.STUDENT), c.myApplications);
router.get('/:id', validate({ params: c.idSchema }), c.getOne);

router.post('/', staff, validate({ body: c.bodySchema }), c.create);
router.put('/:id', staff, validate({ params: c.idSchema, body: c.bodySchema }), c.update);
router.delete('/:id', staff, validate({ params: c.idSchema }), c.remove);

router.put('/:id/application', authorize(ROLES.STUDENT), validate({ params: c.idSchema, body: c.applicationSchema }), c.upsertApplication);
router.delete('/:id/application', authorize(ROLES.STUDENT), validate({ params: c.idSchema }), c.removeApplication);

export default router;
