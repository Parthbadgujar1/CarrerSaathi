import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { idParam } from '../../utils/schemas.js';
import { ROLES } from '../../config/constants.js';
import * as c from './admin.controller.js';
import * as v from './admin.validation.js';

const router = Router();
router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/stats', c.stats);

router.get('/students', validate({ query: v.studentsQuery }), c.listStudents);
router.get('/students/export-fields', c.exportFields);
router.post('/students/export', validate({ body: v.exportSchema }), c.exportStudents);
router.get('/users/:id', validate({ params: idParam }), c.userDetail);
router.patch('/users/:id/status', validate({ params: idParam, body: v.statusSchema }), c.setUserStatus);
router.delete('/users/:id', validate({ params: idParam }), c.deleteUser);
router.post('/mentorships', validate({ body: v.assignSchema }), c.assignMentor);

router.get('/mentors', validate({ query: v.mentorsQuery }), c.listMentors);
router.post('/mentors', validate({ body: v.createMentorSchema }), c.createMentor);
router.post('/mentors/:id/approve', validate({ params: idParam }), c.approveMentor);
router.post('/mentors/:id/reject', validate({ params: idParam }), c.rejectMentor);
router.post('/users/:id/resend-invite', validate({ params: idParam }), c.resendInvite);
router.post('/admins', validate({ body: v.createAdminSchema }), c.createAdmin);

router.get('/settings', c.getSettingsCtrl);
router.patch('/settings', validate({ body: v.settingsSchema }), c.updateSettingsCtrl);
router.post('/announcements', validate({ body: v.announcementSchema }), c.announce);

router.get('/audit-logs', validate({ query: v.listQuery }), c.auditLogs);
router.get('/contact-messages', validate({ query: v.listQuery }), c.contactMessages);
router.patch('/contact-messages/:id', validate({ params: idParam, body: z.object({ status: z.enum(['new', 'resolved']) }) }), c.updateContactMessage);
router.get('/deletion-requests', validate({ query: v.listQuery }), c.deletionRequests);
router.post('/deletion-requests/:id/process', validate({ params: idParam }), c.processDeletion);
router.get('/emails', validate({ query: v.listQuery }), c.emails);
router.post('/emails/:id/retry', validate({ params: idParam }), c.retryEmail);

router.get('/ai', c.ai);
router.post('/ai/test', validate({ body: v.providerSchema }), c.aiTest);
router.delete('/ai/cache', c.aiClearCache);
router.get('/ai/keys', c.aiKeys);
router.post('/ai/keys', validate({ body: v.aiKeySchema }), c.aiKeyAdd);
router.delete('/ai/keys/:provider/:keyId', validate({ params: v.keyParams }), c.aiKeyRemove);
router.patch('/ai/models', validate({ body: v.aiModelsSchema }), c.aiModelsUpdate);

router.patch('/users/:id', validate({ params: idParam, body: v.updateUserSchema }), c.updateUser);
router.post('/students', validate({ body: v.createStudentSchema }), c.createStudent);

export default router;
