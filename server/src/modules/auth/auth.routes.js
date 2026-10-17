import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticate, requireAjaxHeader } from '../../middleware/auth.js';
import { loginLimiter, registerLimiter, sensitiveLimiter } from '../../middleware/rateLimiters.js';
import * as c from './auth.controller.js';
import * as v from './auth.validation.js';

const router = Router();

router.post('/register', registerLimiter, validate({ body: v.registerSchema }), c.register);
router.post('/mentor-apply', registerLimiter, validate({ body: v.mentorApplySchema }), c.applyMentor);
router.post('/login', loginLimiter, validate({ body: v.loginSchema }), c.login);
router.post('/refresh', requireAjaxHeader, c.refresh);
router.post('/logout', requireAjaxHeader, c.logout);
router.post('/logout-all', authenticate, c.logoutAll);
router.get('/me', authenticate, c.me);

router.post('/forgot-password', sensitiveLimiter, validate({ body: v.emailOnlySchema }), c.forgotPassword);
router.post('/reset-password', sensitiveLimiter, validate({ body: v.resetSchema }), c.resetPassword);
router.post('/verify-email', sensitiveLimiter, validate({ body: v.tokenSchema }), c.verifyEmail);
router.post('/resend-verification', authenticate, sensitiveLimiter, c.resendVerification);
router.post('/accept-invite', sensitiveLimiter, validate({ body: v.resetSchema }), c.acceptInvite);
router.post('/change-password', authenticate, sensitiveLimiter, validate({ body: v.changePasswordSchema }), c.changePassword);

export default router;
