import { http, unwrap } from '../lib/http';

export const authService = {
  login: (body) => unwrap(http.post('/auth/login', body)),
  register: (body) => unwrap(http.post('/auth/register', body)),
  applyMentor: (body) => unwrap(http.post('/auth/mentor-apply', body)),
  logout: () => unwrap(http.post('/auth/logout')),
  logoutAll: () => unwrap(http.post('/auth/logout-all')),
  me: () => unwrap(http.get('/auth/me')),
  forgotPassword: (email) => unwrap(http.post('/auth/forgot-password', { email })),
  resetPassword: (token, password) => unwrap(http.post('/auth/reset-password', { token, password })),
  verifyEmail: (token) => unwrap(http.post('/auth/verify-email', { token })),
  resendVerification: () => unwrap(http.post('/auth/resend-verification')),
  acceptInvite: (token, password) => unwrap(http.post('/auth/accept-invite', { token, password })),
  changePassword: (body) => unwrap(http.post('/auth/change-password', body)),
};
