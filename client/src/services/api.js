/**
 * Domain API services. Components never call axios directly — they use these
 * functions (usually through React Query) so endpoints live in one place.
 */
import { http, unwrap } from '../lib/http';

const clean = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null));

export const publicApi = {
  stats: () => unwrap(http.get('/public/stats')),
  config: () => unwrap(http.get('/public/config')),
  contact: (body) => unwrap(http.post('/public/contact', body)),
  search: (q) => unwrap(http.get('/public/search', { params: { q } })),
};

export const userApi = {
  updateProfile: (body) => unwrap(http.patch('/users/me', body)),
  updatePreferences: (body) => unwrap(http.patch('/users/me/preferences', body)),
  sessions: () => unwrap(http.get('/users/me/sessions')),
  revokeSession: (id) => unwrap(http.delete(`/users/me/sessions/${id}`)),
  exportData: () => http.get('/users/me/export', { responseType: 'blob' }),
  requestDeletion: (body) => unwrap(http.post('/users/me/deletion', body)),
  unsubscribe: (token) => unwrap(http.post('/users/unsubscribe', { token })),
};

export const studentApi = {
  dashboard: () => unwrap(http.get('/students/me/dashboard')),
  careerKit: () => unwrap(http.get('/students/me/career-kit')),
  updateCareerKit: (items) => unwrap(http.put('/students/me/career-kit', { items })),
  resume: () => unwrap(http.get('/students/me/resume')),
  saveResume: (body) => unwrap(http.put('/students/me/resume', body)),
  mentorNotes: () => unwrap(http.get('/students/me/mentor-notes')),
};

export const roadmapApi = {
  list: (params) => unwrap(http.get('/roadmaps', { params: clean(params) })),
  get: (slug) => unwrap(http.get(`/roadmaps/${slug}`)),
  enrollments: () => unwrap(http.get('/roadmaps/me/enrollments')),
  enroll: (id) => unwrap(http.post(`/roadmaps/${id}/enroll`)),
  unenroll: (id) => unwrap(http.delete(`/roadmaps/${id}/enroll`)),
  toggleStep: (id, key, done) => unwrap(http.patch(`/roadmaps/${id}/steps`, { key, done })),
  quiz: () => unwrap(http.get('/roadmaps/quiz')),
  recommend: (answers) => unwrap(http.post('/roadmaps/recommend', { answers })),
  generate: (body) => unwrap(http.post('/roadmaps/generate', body, { timeout: 90_000 })),
  saveDraft: (draftKey) => unwrap(http.post('/roadmaps/save-draft', { draftKey })),
  adminList: () => unwrap(http.get('/roadmaps/admin/all')),
  adminCreate: (body) => unwrap(http.post('/roadmaps/admin', body)),
  adminUpdate: (id, body) => unwrap(http.put(`/roadmaps/admin/${id}`, body)),
  adminDelete: (id) => unwrap(http.delete(`/roadmaps/admin/${id}`)),
  adminBulk: (roadmaps, mode) => unwrap(http.post('/roadmaps/admin/bulk', { roadmaps, mode }, { timeout: 120_000 })),
};

export const aiApi = {
  chat: (message, history) => unwrap(http.post('/ai/chat', { message, history }, { timeout: 60_000 })),
  quota: () => unwrap(http.get('/ai/quota')),
};

export const opportunityApi = {
  list: (params) => unwrap(http.get('/opportunities', { params: clean(params) })),
  manage: (params) => unwrap(http.get('/opportunities/manage', { params: clean(params) })),
  get: (id) => unwrap(http.get(`/opportunities/${id}`)),
  create: (body) => unwrap(http.post('/opportunities', body)),
  update: (id, body) => unwrap(http.put(`/opportunities/${id}`, body)),
  remove: (id) => unwrap(http.delete(`/opportunities/${id}`)),
  external: () => unwrap(http.get('/opportunities/external')),
  myApplications: () => unwrap(http.get('/opportunities/applications/me')),
  track: (id, body) => unwrap(http.put(`/opportunities/${id}/application`, body)),
  untrack: (id) => unwrap(http.delete(`/opportunities/${id}/application`)),
};

export const meetingApi = {
  list: (params) => unwrap(http.get('/meetings', { params: clean(params) })),
  get: (id) => unwrap(http.get(`/meetings/${id}`)),
  create: (body) => unwrap(http.post('/meetings', body)),
  update: (id, body) => unwrap(http.put(`/meetings/${id}`, body)),
  cancel: (id) => unwrap(http.post(`/meetings/${id}/cancel`)),
  rsvp: (id, attending) => unwrap(http.post(`/meetings/${id}/rsvp`, { attending })),
};

export const mentorshipApi = {
  directory: (params) => unwrap(http.get('/mentorship/mentors', { params: clean(params) })),
  request: (mentorId, message) => unwrap(http.post('/mentorship/requests', { mentorId, message })),
  mine: () => unwrap(http.get('/mentorship/mine')),
  respond: (id, accept) => unwrap(http.post(`/mentorship/${id}/respond`, { accept })),
  end: (id) => unwrap(http.post(`/mentorship/${id}/end`)),
  students: (params) => unwrap(http.get('/mentorship/students', { params: clean(params) })),
  student: (id) => unwrap(http.get(`/mentorship/students/${id}`)),
  addNote: (id, body) => unwrap(http.post(`/mentorship/students/${id}/notes`, body)),
  updateNote: (id, body) => unwrap(http.patch(`/mentorship/notes/${id}`, body)),
  deleteNote: (id) => unwrap(http.delete(`/mentorship/notes/${id}`)),
};

export const chatApi = {
  conversations: () => unwrap(http.get('/chat/conversations')),
  direct: (userId) => unwrap(http.post('/chat/direct', { userId })),
  messages: (id, before) => unwrap(http.get(`/chat/conversations/${id}/messages`, { params: clean({ before }) })),
  send: (id, text) => unwrap(http.post(`/chat/conversations/${id}/messages`, { text })),
  read: (id) => unwrap(http.post(`/chat/conversations/${id}/read`)),
  remove: (messageId) => unwrap(http.delete(`/chat/messages/${messageId}`)),
};

export const communityApi = {
  list: (params) => unwrap(http.get('/communities', { params: clean(params) })),
  get: (id) => unwrap(http.get(`/communities/${id}`)),
  create: (body) => unwrap(http.post('/communities', body)),
  join: (id) => unwrap(http.post(`/communities/${id}/join`)),
  leave: (id) => unwrap(http.post(`/communities/${id}/leave`)),
  update: (id, body) => unwrap(http.patch(`/communities/${id}`, body)),
  remove: (id) => unwrap(http.delete(`/communities/${id}`)),
  removeMember: (id, userId) => unwrap(http.delete(`/communities/${id}/members/${userId}`)),
};

export const wellnessApi = {
  history: (days = 30) => unwrap(http.get('/wellness', { params: { days } })),
  checkin: (body) => unwrap(http.put('/wellness/today', body)),
  resources: () => unwrap(http.get('/wellness/resources')),
};

export const notificationApi = {
  list: (params) => unwrap(http.get('/notifications', { params: clean(params) })),
  readAll: () => unwrap(http.post('/notifications/read-all')),
  read: (id) => unwrap(http.post(`/notifications/${id}/read`)),
};

export const adminApi = {
  stats: () => unwrap(http.get('/admin/stats')),
  students: (params) => unwrap(http.get('/admin/students', { params: clean(params) })),
  exportFields: () => unwrap(http.get('/admin/students/export-fields')),
  exportStudents: (body) => http.post('/admin/students/export', body, { responseType: 'blob', timeout: 120_000 }),
  user: (id) => unwrap(http.get(`/admin/users/${id}`)),
  setStatus: (id, status) => unwrap(http.patch(`/admin/users/${id}/status`, { status })),
  deleteUser: (id) => unwrap(http.delete(`/admin/users/${id}`)),
  assignMentor: (studentId, mentorId) => unwrap(http.post('/admin/mentorships', { studentId, mentorId })),
  mentors: (params) => unwrap(http.get('/admin/mentors', { params: clean(params) })),
  createMentor: (body) => unwrap(http.post('/admin/mentors', body)),
  approveMentor: (id) => unwrap(http.post(`/admin/mentors/${id}/approve`)),
  rejectMentor: (id) => unwrap(http.post(`/admin/mentors/${id}/reject`)),
  resendInvite: (id) => unwrap(http.post(`/admin/users/${id}/resend-invite`)),
  createAdmin: (body) => unwrap(http.post('/admin/admins', body)),
  settings: () => unwrap(http.get('/admin/settings')),
  updateSettings: (body) => unwrap(http.patch('/admin/settings', body)),
  announce: (body) => unwrap(http.post('/admin/announcements', body)),
  auditLogs: (params) => unwrap(http.get('/admin/audit-logs', { params: clean(params) })),
  contactMessages: (params) => unwrap(http.get('/admin/contact-messages', { params: clean(params) })),
  updateContactMessage: (id, status) => unwrap(http.patch(`/admin/contact-messages/${id}`, { status })),
  deletionRequests: (params) => unwrap(http.get('/admin/deletion-requests', { params: clean(params) })),
  processDeletion: (id) => unwrap(http.post(`/admin/deletion-requests/${id}/process`)),
  emails: (params) => unwrap(http.get('/admin/emails', { params: clean(params) })),
  retryEmail: (id) => unwrap(http.post(`/admin/emails/${id}/retry`)),
  ai: () => unwrap(http.get('/admin/ai')),
  aiTest: (provider) => unwrap(http.post('/admin/ai/test', { provider }, { timeout: 60_000 })),
  aiClearCache: () => unwrap(http.delete('/admin/ai/cache')),
  aiKeys: () => unwrap(http.get('/admin/ai/keys')),
  aiKeyAdd: (body) => unwrap(http.post('/admin/ai/keys', body)),
  aiKeyRemove: (provider, keyId) => unwrap(http.delete(`/admin/ai/keys/${provider}/${keyId}`)),
  aiModels: (body) => unwrap(http.patch('/admin/ai/models', body)),
  updateUser: (id, body) => unwrap(http.patch(`/admin/users/${id}`, body)),
  createStudent: (body) => unwrap(http.post('/admin/students', body)),
};

export const testApi = {
  list: () => unwrap(http.get('/tests')),
  start: (id) => unwrap(http.post(`/tests/${id}/start`)),
  saveAnswers: (attemptId, answers) => unwrap(http.put(`/tests/attempts/${attemptId}/answers`, { answers })),
  submit: (attemptId, answers) => unwrap(http.post(`/tests/attempts/${attemptId}/submit`, answers ? { answers } : {})),
  attempt: (attemptId) => unwrap(http.get(`/tests/attempts/${attemptId}`)),
  resultsMe: () => unwrap(http.get('/tests/results/me')),
};

export const practiceApi = {
  options: () => unwrap(http.get('/practice/options')),
  generate: (body) => unwrap(http.post('/practice/generate', body, { timeout: 90_000 })),
  submit: (id, answers) => unwrap(http.post(`/practice/${id}/submit`, { answers })),
  history: () => unwrap(http.get('/practice/history')),
  get: (id) => unwrap(http.get(`/practice/${id}`)),
};

export const adminTestApi = {
  list: (params) => unwrap(http.get('/admin/tests', { params: clean(params) })),
  get: (id) => unwrap(http.get(`/admin/tests/${id}`)),
  create: (body) => unwrap(http.post('/admin/tests', body)),
  update: (id, body) => unwrap(http.put(`/admin/tests/${id}`, body)),
  setStatus: (id, status) => unwrap(http.patch(`/admin/tests/${id}/status`, { status })),
  duplicate: (id) => unwrap(http.post(`/admin/tests/${id}/duplicate`)),
  remove: (id) => unwrap(http.delete(`/admin/tests/${id}`)),
  results: (id) => unwrap(http.get(`/admin/tests/${id}/results`)),
  exportResults: (id) => http.get(`/admin/tests/${id}/results.xlsx`, { responseType: 'blob', timeout: 120_000 }),
  template: () => http.get('/admin/tests/template.xlsx', { responseType: 'blob' }),
  parseExcel: (file) =>
    file.arrayBuffer().then((buf) =>
      unwrap(http.post('/admin/tests/parse-excel', buf, { params: /\.csv$/i.test(file.name) ? { format: 'csv' } : {}, headers: { 'Content-Type': 'application/octet-stream' }, transformRequest: [(d) => d] })),
    ),
  generateQuestions: (body) => unwrap(http.post('/admin/tests/generate-questions', body, { timeout: 120_000 })),
  audienceOptions: () => unwrap(http.get('/admin/tests/audience-options')),
  audiencePreview: (audience) => unwrap(http.post('/admin/tests/audience-preview', { audience })),
};

export const healthApi = {
  ready: () => fetch('/api/health/ready').then((r) => r.json()),
};

/** Triggers a browser download for a blob response. */
export function downloadBlob(response, fallbackName) {
  const disposition = response.headers?.['content-disposition'] || '';
  const name = disposition.match(/filename="?([^"]+)"?/)?.[1] || fallbackName;
  const url = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
