import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../config/constants.js';
import * as c from './students.controller.js';

const router = Router();
router.use(authenticate, authorize(ROLES.STUDENT));

router.get('/me/dashboard', c.dashboard);
router.get('/me/career-kit', c.getCareerKit);
router.put('/me/career-kit', validate({ body: c.careerKitSchema }), c.updateCareerKit);
router.get('/me/resume', c.getResume);
router.put('/me/resume', validate({ body: c.resumeSchema }), c.updateResume);
router.get('/me/mentor-notes', c.myMentorNotes);

export default router;
