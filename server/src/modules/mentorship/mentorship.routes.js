import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../config/constants.js';
import * as c from './mentorship.controller.js';

const router = Router();
router.use(authenticate);
const student = authorize(ROLES.STUDENT);
const mentor = authorize(ROLES.MENTOR);

router.get('/mentors', student, validate({ query: c.directoryQuery }), c.directory);
router.post('/requests', student, validate({ body: c.requestSchema }), c.requestMentor);
router.get('/mine', authorize(ROLES.STUDENT, ROLES.MENTOR), c.mine);
router.post('/:id/respond', mentor, validate({ params: c.idSchema, body: c.respondSchema }), c.respond);
router.post('/:id/end', authorize(ROLES.STUDENT, ROLES.MENTOR), validate({ params: c.idSchema }), c.end);

router.get('/students', mentor, validate({ query: c.studentsQuery }), c.students);
router.get('/students/:id', mentor, validate({ params: c.idSchema }), c.studentDetail);
router.post('/students/:id/notes', mentor, validate({ params: c.idSchema, body: c.noteSchema }), c.addNote);
router.patch('/notes/:id', authorize(ROLES.STUDENT, ROLES.MENTOR), validate({ params: c.idSchema, body: c.noteUpdateSchema }), c.updateNote);
router.delete('/notes/:id', mentor, validate({ params: c.idSchema }), c.deleteNote);

export default router;
