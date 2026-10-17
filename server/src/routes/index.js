import { Router } from 'express';
import { dbGuard } from '../middleware/resilience.js';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/users/users.routes.js';
import studentRoutes from '../modules/students/students.routes.js';
import roadmapRoutes from '../modules/roadmaps/roadmaps.routes.js';
import aiRoutes from '../modules/ai/ai.routes.js';
import opportunityRoutes from '../modules/opportunities/opportunities.routes.js';
import meetingRoutes from '../modules/meetings/meetings.routes.js';
import mentorshipRoutes from '../modules/mentorship/mentorship.routes.js';
import chatRoutes from '../modules/chat/chat.routes.js';
import communityRoutes from '../modules/communities/communities.routes.js';
import wellnessRoutes from '../modules/wellness/wellness.routes.js';
import notificationRoutes from '../modules/notifications/notifications.routes.js';
import adminRoutes from '../modules/admin/admin.routes.js';
import publicRoutes from '../modules/public/public.routes.js';
import adminTestRoutes from '../modules/tests/tests.admin.routes.js';
import { practiceRouter, testsRouter } from '../modules/tests/tests.student.routes.js';

/** Versioned API: /api/v1/... Every feature module is mounted independently. */
const v1 = Router();
v1.use(dbGuard);
v1.use('/auth', authRoutes);
v1.use('/users', userRoutes);
v1.use('/students', studentRoutes);
v1.use('/roadmaps', roadmapRoutes);
v1.use('/ai', aiRoutes);
v1.use('/opportunities', opportunityRoutes);
v1.use('/meetings', meetingRoutes);
v1.use('/mentorship', mentorshipRoutes);
v1.use('/chat', chatRoutes);
v1.use('/communities', communityRoutes);
v1.use('/wellness', wellnessRoutes);
v1.use('/notifications', notificationRoutes);
v1.use('/admin/tests', adminTestRoutes); // before /admin so its own raw-body upload route is matched first
v1.use('/admin', adminRoutes);
v1.use('/tests', testsRouter);
v1.use('/practice', practiceRouter);
v1.use('/public', publicRoutes);

export default v1;
