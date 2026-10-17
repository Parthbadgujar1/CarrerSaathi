/**
 * End-to-end smoke test against a RUNNING server (default http://localhost:5000).
 *   npm run seed:reset && npm start   (in another terminal)
 *   npm run smoke
 * Exercises every role and module through the public HTTP API.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
const BASE = process.env.SMOKE_URL || `http://localhost:${process.env.PORT || 5000}`;

let passed = 0;
let failed = 0;
const results = [];

function check(name, cond, info = '') {
  if (cond) passed += 1;
  else failed += 1;
  results.push(`${cond ? '✔' : '✘'} ${name}${!cond && info ? `  → ${typeof info === 'string' ? info : JSON.stringify(info).slice(0, 300)}` : ''}`);
}

class Client {
  constructor() {
    this.token = null;
    this.cookie = null;
  }
  async req(method, url, body, { raw = false, headers = {} } = {}) {
    const res = await fetch(BASE + url, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-requested-with': 'XMLHttpRequest',
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie && setCookie.includes('cs_rt=')) {
      const value = setCookie.match(/cs_rt=([^;]*)/)[1];
      this.cookie = value ? `cs_rt=${value}` : null;
    }
    if (raw) return res;
    const json = await res.json().catch(() => ({}));
    return { status: res.status, ...json };
  }
  async login(email, password) {
    const r = await this.req('POST', '/api/v1/auth/login', { email, password });
    this.token = r.data?.accessToken;
    return r;
  }
}

function latestMailLink(to, contains) {
  const dir = path.join(root, 'storage', 'mail');
  const files = fs.readdirSync(dir).filter((f) => f.includes(to.replace(/[^a-z0-9@._-]/gi, '_'))).sort();
  for (const f of files.reverse()) {
    const html = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = html.match(new RegExp(`href="(http[^"]*${contains}[^"]*)"`));
    if (m) return m[1];
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const env = process.env;
  const guest = new Client();

  // ---------------- public & health
  const health = await guest.req('GET', '/api/health/ready');
  check('health/ready reports database ok', health.checks?.database?.ok === true, health);
  check('public stats', (await guest.req('GET', '/api/v1/public/stats')).data?.roadmaps >= 15);
  check('public roadmap library', (await guest.req('GET', '/api/v1/roadmaps')).data?.length >= 15);
  check('public roadmap detail', (await guest.req('GET', '/api/v1/roadmaps/data-analytics')).data?.roadmap?.phases?.length > 0);
  check('guest search', (await guest.req('GET', '/api/v1/public/search?q=data')).data?.roadmaps?.length > 0);
  check('unknown API → JSON 404', (await guest.req('GET', '/api/v1/does-not-exist')).error?.code === 'ROUTE_NOT_FOUND');
  check('protected route without token → 401', (await guest.req('GET', '/api/v1/auth/me')).status === 401);
  const contact = await guest.req('POST', '/api/v1/public/contact', { name: 'Smoke Tester', email: 'smoke@example.com', subject: 'Hello', message: 'This is an automated smoke test message.', consent: true });
  check('contact form', contact.status === 201, contact);
  const badContact = await guest.req('POST', '/api/v1/public/contact', { name: 'X', email: 'bad', message: 'short', consent: false });
  check('contact form validation errors', badContact.status === 400 && badContact.error?.details?.length >= 3, badContact);
  const nosql = await guest.req('POST', '/api/v1/auth/login', { email: { $gt: '' }, password: { $gt: '' } });
  check('NoSQL injection payload rejected', nosql.status === 400, nosql);

  // ---------------- student
  const s = new Client();
  const bad = await s.login(env.SEED_STUDENT_EMAIL, 'wrong-password-1');
  check('wrong password → 401', bad.status === 401 && bad.error?.code === 'INVALID_CREDENTIALS', bad);
  const sl = await s.login(env.SEED_STUDENT_EMAIL, env.SEED_STUDENT_PASSWORD);
  check('student login', sl.status === 200 && s.token && s.cookie, sl);
  check('student /auth/me', (await s.req('GET', '/api/v1/auth/me')).data?.user?.role === 'student');
  const dash = await s.req('GET', '/api/v1/students/me/dashboard');
  check('student dashboard', dash.status === 200 && typeof dash.data?.readiness?.score === 'number', dash);
  check('dashboard has next steps', dash.data?.nextSteps?.length > 0, dash.data?.nextSteps);
  check('RBAC: student cannot open admin stats', (await s.req('GET', '/api/v1/admin/stats')).status === 403);

  const enrolls = await s.req('GET', '/api/v1/roadmaps/me/enrollments');
  check('my enrollments', enrolls.data?.length >= 1, enrolls);
  const lib = await s.req('GET', '/api/v1/roadmaps');
  const uiux = lib.data.find((r) => r.slug === 'ui-ux-design');
  const enroll = await s.req('POST', `/api/v1/roadmaps/${uiux._id}/enroll`);
  check('enroll in roadmap', enroll.status === 201, enroll);
  const detail = await s.req('GET', '/api/v1/roadmaps/ui-ux-design');
  check('roadmap detail with enrollment + skill gap', detail.data?.enrollment && detail.data?.skillGap, detail);
  const firstKey = detail.data.roadmap.phases[0].steps[0].key;
  const step = await s.req('PATCH', `/api/v1/roadmaps/${uiux._id}/steps`, { key: firstKey, done: true });
  check('toggle roadmap step updates progress', step.data?.progress > 0, step);
  check('reject unknown step', (await s.req('PATCH', `/api/v1/roadmaps/${uiux._id}/steps`, { key: 'nope', done: true })).status === 400);

  const quiz = await s.req('GET', '/api/v1/roadmaps/quiz');
  const answers = Object.fromEntries(quiz.data.map((q) => [q.id, q.options[0].id]));
  const rec = await s.req('POST', '/api/v1/roadmaps/recommend', { answers });
  check('career compass recommendations', rec.data?.length >= 1, rec);

  const gen1 = await s.req('POST', '/api/v1/roadmaps/generate', { fields: ['web development'] });
  check('generate: single known field served from library (zero cost)', gen1.data?.source === 'library' && gen1.data?.libraryRoadmapId, gen1);
  const gen2 = await s.req('POST', '/api/v1/roadmaps/generate', { fields: ['data analytics', 'digital marketing'], goal: 'growth analyst' });
  check('generate: multi-field works without AI keys (fallback blend or AI)', gen2.status === 200 && gen2.data?.roadmap?.phases?.length > 0, gen2);
  if (gen2.data?.draftKey) {
    const saved = await s.req('POST', '/api/v1/roadmaps/save-draft', { draftKey: gen2.data.draftKey });
    check('save generated roadmap to my roadmaps', saved.status === 201, saved);
  }
  const chat1 = await s.req('POST', '/api/v1/ai/chat', { message: 'How do I improve my resume?' });
  check('AI counsellor answers (AI or rules fallback)', chat1.data?.reply?.length > 20, chat1);
  const crisis = await s.req('POST', '/api/v1/ai/chat', { message: 'I want to end my life' });
  check('crisis message → helpline response', /14416/.test(crisis.data?.reply || ''), crisis);

  const opps = await s.req('GET', '/api/v1/opportunities?forMe=true');
  check('opportunities feed', opps.data?.items?.length >= 1, opps);
  const anyOpp = (await s.req('GET', '/api/v1/opportunities')).data.items[0];
  check('opportunity detail', (await s.req('GET', `/api/v1/opportunities/${anyOpp._id}`)).status === 200);
  check('application tracker upsert', (await s.req('PUT', `/api/v1/opportunities/${anyOpp._id}/application`, { status: 'applied', notes: 'smoke' })).status === 200);
  check('my applications', (await s.req('GET', '/api/v1/opportunities/applications/me')).data?.length >= 1);
  const ext = await s.req('GET', '/api/v1/opportunities/external');
  check('external links (Unstop/Indeed + ecosystem)', ext.data?.searches?.[0]?.links?.some((l) => l.url.includes('unstop.com')) && ext.data?.ecosystem?.length === 4, ext);

  const meetings = await s.req('GET', '/api/v1/meetings');
  check('student sees sessions', meetings.data?.items?.length >= 2, meetings);
  const m0 = meetings.data.items[0];
  check('session detail', (await s.req('GET', `/api/v1/meetings/${m0._id}`)).status === 200);
  check('RSVP to session', (await s.req('POST', `/api/v1/meetings/${m0._id}/rsvp`, { attending: true })).data?.attending === true);
  check('student cannot create session', (await s.req('POST', '/api/v1/meetings', {})).status === 403);

  const mine = await s.req('GET', '/api/v1/mentorship/mine');
  check('my mentors', mine.data?.length >= 1, mine);
  check('mentor directory', (await s.req('GET', '/api/v1/mentorship/mentors')).data?.items?.length >= 2);
  const convos = await s.req('GET', '/api/v1/chat/conversations');
  check('conversation list (direct + communities)', convos.data?.some((c) => c.type === 'direct') && convos.data?.some((c) => c.type === 'community'), convos);
  const direct = convos.data.find((c) => c.type === 'direct');
  check('read messages', (await s.req('GET', `/api/v1/chat/conversations/${direct._id}/messages`)).data?.messages?.length >= 1);
  const sent = await s.req('POST', `/api/v1/chat/conversations/${direct._id}/messages`, { text: 'Hello from the smoke test!' });
  check('send message (REST fallback)', sent.status === 201, sent);
  check('mark read', (await s.req('POST', `/api/v1/chat/conversations/${direct._id}/read`)).success === true);

  const comms = await s.req('GET', '/api/v1/communities');
  check('communities list', comms.data?.items?.length >= 5, comms);
  const notJoined = comms.data.items.find((c) => !c.joined);
  if (notJoined) check('join community', (await s.req('POST', `/api/v1/communities/${notJoined._id}/join`)).status === 200);
  const newComm = await s.req('POST', '/api/v1/communities', { name: `Smoke Circle ${Date.now()}`, description: 'temp', tags: ['test'] });
  check('create community', newComm.status === 201, newComm);

  const well = await s.req('PUT', '/api/v1/wellness/today', { mood: 4, stress: 2, sleepHours: 7, exerciseMinutes: 30, waterGlasses: 8, journal: 'Private smoke-test note' });
  check('wellness check-in', well.status === 200, well);
  const wellGet = await s.req('GET', '/api/v1/wellness');
  check('wellness history decrypts own journal', wellGet.data?.today?.journal === 'Private smoke-test note', wellGet.data?.today);
  check('wellness resources', (await s.req('GET', '/api/v1/wellness/resources')).data?.helplines?.length >= 1);

  const kit = await s.req('GET', '/api/v1/students/me/career-kit');
  check('career kit', kit.data?.kit?.items?.length >= 8, kit);
  check('career kit update', (await s.req('PUT', '/api/v1/students/me/career-kit', { items: { mockInterview: true } })).status === 200);
  check('reject unknown kit item', (await s.req('PUT', '/api/v1/students/me/career-kit', { items: { hacker: true } })).status === 400);
  const resume = await s.req('PUT', '/api/v1/students/me/resume', { summary: 'Aspiring full stack developer.', projects: [{ name: 'Portfolio', link: 'https://example.com', tech: 'React', description: 'My site' }], achievements: ['Hackathon finalist'] });
  check('resume save', resume.status === 200, resume);
  const profile = await s.req('PATCH', '/api/v1/users/me', { headline: 'Aspiring developer', skills: ['React', 'Node.js', 'MongoDB'], address: { city: 'Jaipur' } });
  check('profile update keeps other address fields', profile.data?.user?.address?.state === 'Rajasthan' && profile.data?.user?.address?.city === 'Jaipur', profile.data?.user?.address);
  check('profile validation (bad URL)', (await s.req('PATCH', '/api/v1/users/me', { links: { linkedin: 'javascript:alert(1)' } })).status === 400);
  check('notifications', (await s.req('GET', '/api/v1/notifications')).status === 200);
  check('signed-in search', (await s.req('GET', '/api/v1/public/search?q=intern')).data?.opportunities !== undefined);
  check('device sessions list', (await s.req('GET', '/api/v1/users/me/sessions')).data?.some((x) => x.current));
  const exp = await s.req('GET', '/api/v1/users/me/export', null, { raw: true });
  check('data export download', exp.status === 200 && (exp.headers.get('content-disposition') || '').includes('attachment'));

  // refresh rotation + reuse detection
  const oldCookie = s.cookie;
  const r1 = await s.req('POST', '/api/v1/auth/refresh');
  check('refresh token rotation', r1.status === 200 && s.cookie !== oldCookie, r1);
  check('refresh requires X-Requested-With (CSRF guard)', (await s.req('POST', '/api/v1/auth/refresh', null, { headers: { 'x-requested-with': '' } })).status === 403);
  await sleep(50);
  const replay = new Client();
  replay.cookie = oldCookie;
  // Inside the 30s grace window the old token is tolerated (parallel tabs) without rotation.
  check('parallel refresh within grace window tolerated', (await replay.req('POST', '/api/v1/auth/refresh')).status === 200);
  check('logout', (await s.req('POST', '/api/v1/auth/logout')).status === 200);
  check('access after logout rejected', (await s.req('GET', '/api/v1/auth/me')).status === 401);

  // ---------------- registration, verification, password reset, deletion
  const email = `smoke.${Date.now()}@example.com`;
  const n = new Client();
  const reg = await n.req('POST', '/api/v1/auth/register', {
    name: 'Smoke Student', email, password: 'Smoke12345', phone: '+91 9876543210',
    education: { degree: 'BBA', branch: 'Marketing', college: 'Test College', graduationYear: 2027, currentYear: 2 },
    careerTracks: ['digital-marketing'], consents: { terms: true, marketingEmails: true }, utm: { utmSource: 'smoke-test' },
  });
  n.token = reg.data?.accessToken;
  check('register student', reg.status === 201 && n.token, reg);
  check('duplicate email rejected', (await guest.req('POST', '/api/v1/auth/register', { name: 'Dup', email, password: 'Smoke12345', education: { degree: 'BBA', college: 'X College', graduationYear: 2027 }, consents: { terms: true } })).status === 409);
  check('terms consent required', (await guest.req('POST', '/api/v1/auth/register', { name: 'No Consent', email: 'nc@example.com', password: 'Smoke12345', education: { degree: 'BBA', college: 'X College', graduationYear: 2027 }, consents: { terms: false } })).status === 400);
  check('weak password rejected', (await guest.req('POST', '/api/v1/auth/register', { name: 'Weak', email: 'weak@example.com', password: 'short', education: { degree: 'BBA', college: 'X College', graduationYear: 2027 }, consents: { terms: true } })).status === 400);
  await sleep(1500);
  const verifyLink = latestMailLink(email, 'verify-email');
  check('verification email written', Boolean(verifyLink));
  if (verifyLink) check('verify email', (await guest.req('POST', '/api/v1/auth/verify-email', { token: verifyLink.split('/').pop() })).status === 200);
  check('forgot password (no enumeration)', (await guest.req('POST', '/api/v1/auth/forgot-password', { email: 'nobody@example.com' })).status === 200);
  await guest.req('POST', '/api/v1/auth/forgot-password', { email });
  await sleep(1500);
  const resetLink = latestMailLink(email, 'reset-password');
  check('reset email written', Boolean(resetLink));
  if (resetLink) {
    check('reset password', (await guest.req('POST', '/api/v1/auth/reset-password', { token: resetLink.split('/').pop(), password: 'NewSmoke123' })).status === 200);
    check('old session revoked after reset', (await n.req('GET', '/api/v1/auth/me')).status === 401);
    check('reset link is single-use', (await guest.req('POST', '/api/v1/auth/reset-password', { token: resetLink.split('/').pop(), password: 'Another123' })).status === 400);
    await n.login(email, 'NewSmoke123');
    const ch = await n.req('POST', '/api/v1/auth/change-password', { currentPassword: 'NewSmoke123', newPassword: 'Changed123' });
    n.token = ch.data?.accessToken || n.token;
    check('change password keeps current device signed in', ch.status === 200 && (await n.req('GET', '/api/v1/auth/me')).status === 200, ch);
    const del = await n.req('POST', '/api/v1/users/me/deletion', { password: 'Changed123', reason: 'smoke test' });
    check('request account deletion', del.status === 200, del);
    const back = await n.login(email, 'Changed123');
    check('signing in cancels pending deletion', back.status === 200 && /cancelled/i.test(back.message || ''), back);
  }

  // ---------------- mentor
  const m = new Client();
  const ml = await m.login(env.SEED_MENTOR_EMAIL, env.SEED_MENTOR_PASSWORD);
  check('mentor login', ml.status === 200);
  const mentorId = ml.data?.user?._id;
  const mentees = await m.req('GET', '/api/v1/mentorship/students?scope=mine');
  check('mentor sees mentees', mentees.data?.items?.length >= 1, mentees);
  const allStudents = await m.req('GET', '/api/v1/mentorship/students?scope=all');
  check('mentor can browse all students (privacy-reduced)', allStudents.data?.items?.length >= 5 && !('email' in allStudents.data.items[0]) && !('phone' in allStudents.data.items[0]), allStudents.data?.items?.[0]);
  const mentee = mentees.data.items[0];
  const sd = await m.req('GET', `/api/v1/mentorship/students/${mentee._id}`);
  check('mentor views mentee progress (+ shared wellness)', sd.data?.isMentee && sd.data?.readiness && sd.data?.wellness, sd);
  check('mentor adds goal for mentee', (await m.req('POST', `/api/v1/mentorship/students/${mentee._id}/notes`, { type: 'goal', text: 'Finish phase 2 by next week' })).status === 201);
  const pending = (await m.req('GET', '/api/v1/mentorship/mine')).data.find((x) => x.status === 'pending');
  if (pending) check('mentor accepts request', (await m.req('POST', `/api/v1/mentorship/${pending._id}/respond`, { accept: true })).status === 200);
  const mo = await m.req('POST', '/api/v1/opportunities', { title: 'Smoke React Internship', organization: 'Smoke Labs', type: 'internship', source: 'internsaathi', tracks: ['full-stack-web-development'], deadline: new Date(Date.now() + 7 * 864e5).toISOString() });
  check('mentor posts opportunity', mo.status === 201, mo);
  const manage = await m.req('GET', '/api/v1/opportunities/manage');
  check('mentor manage list shows only own posts', manage.data?.items?.length >= 1 && manage.data.items.every((o) => o.postedBy?._id === mentorId), manage.data?.items?.map((o) => o.postedBy));
  const mm = await m.req('POST', '/api/v1/meetings', { title: 'Smoke mentoring circle', startAt: new Date(Date.now() + 2 * 864e5).toISOString(), durationMinutes: 45, audience: { type: 'mentees' } });
  check('mentor schedules session for mentees', mm.status === 201, mm);
  check('mentor cannot target all users', (await m.req('POST', '/api/v1/meetings', { title: 'Too broad', startAt: new Date(Date.now() + 864e5).toISOString(), audience: { type: 'all' } })).status === 403);

  // ---------------- admin
  const a = new Client();
  check('admin login', (await a.login(env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD)).status === 200);
  const stats = await a.req('GET', '/api/v1/admin/stats');
  check('admin stats', stats.data?.totals?.students >= 8 && stats.data?.signups?.length === 30, stats);
  const list = await a.req('GET', '/api/v1/admin/students?limit=5&sort=readiness');
  check('admin student list + pagination', list.data?.items?.length === 5 && list.data?.pagination?.total >= 8, list);
  check('admin student filters', (await a.req('GET', '/api/v1/admin/students?degree=B.Tech')).data?.items?.every((x) => /b\.tech/i.test(x.education.degree)));
  const xlsx = await a.req('POST', '/api/v1/admin/students/export', { filters: {}, fields: ['name', 'email', 'phone', 'college', 'city', 'registeredAt'] }, { raw: true });
  const buf = Buffer.from(await xlsx.arrayBuffer());
  check('Excel export (.xlsx)', xlsx.status === 200 && buf.subarray(0, 2).toString() === 'PK' && buf.length > 3000, `${xlsx.status} ${buf.length}`);
  const detailA = await a.req('GET', `/api/v1/admin/users/${mentee._id}`);
  check('admin user detail with contact info', detailA.data?.user?.email && detailA.data?.readiness, detailA);
  const mentorsList = await a.req('GET', '/api/v1/admin/mentors?status=pending');
  check('admin sees pending mentor applications', mentorsList.data?.items?.length >= 1, mentorsList);
  check('approve mentor application', (await a.req('POST', `/api/v1/admin/mentors/${mentorsList.data.items[0]._id}/approve`)).status === 200);
  const newMentorEmail = `mentor.${Date.now()}@example.com`;
  const cm = await a.req('POST', '/api/v1/admin/mentors', { name: 'Invited Mentor', email: newMentorEmail, mentorProfile: { designation: 'Engineer', company: 'Acme', expertise: ['Cloud'], experienceYears: 5 } });
  check('admin adds mentor → invite link', cm.status === 201 && cm.data?.inviteLink, cm);
  if (cm.data?.inviteLink) {
    const im = new Client();
    const acc = await im.req('POST', '/api/v1/auth/accept-invite', { token: cm.data.inviteLink.split('/').pop(), password: 'Mentor12345' });
    check('invited mentor activates account', acc.status === 200 && acc.data?.user?.status === 'active', acc);
  }
  const studentForAssign = list.data.items.find((x) => x._id !== mentee._id);
  const mentorAny = (await a.req('GET', '/api/v1/admin/mentors?status=active')).data.items[0];
  check('admin assigns mentor', (await a.req('POST', '/api/v1/admin/mentorships', { studentId: studentForAssign._id, mentorId: mentorAny._id })).status === 200);
  check('admin settings read', (await a.req('GET', '/api/v1/admin/settings')).data?.aiEnabled !== undefined);
  const original = (await a.req('GET', '/api/v1/admin/settings')).data?.ecosystemLinks?.internsaathi;
  check('admin settings update', (await a.req('PATCH', '/api/v1/admin/settings', { ecosystemLinks: { internsaathi: 'https://example.com/internsaathi' } })).data?.ecosystemLinks?.internsaathi === 'https://example.com/internsaathi');
  await a.req('PATCH', '/api/v1/admin/settings', { ecosystemLinks: { internsaathi: original } }); // leave real data untouched
  check('admin announcement', (await a.req('POST', '/api/v1/admin/announcements', { title: 'Smoke announcement', body: 'Hello everyone from the smoke test', audience: 'students', sendEmail: true })).status === 200);
  check('admin AI status', Array.isArray((await a.req('GET', '/api/v1/admin/ai')).data?.providers));
  check('admin audit log', (await a.req('GET', '/api/v1/admin/audit-logs')).data?.items?.length >= 1);
  check('admin inbox', (await a.req('GET', '/api/v1/admin/contact-messages')).data?.items?.length >= 1);
  check('admin email outbox', (await a.req('GET', '/api/v1/admin/emails')).data?.items?.length >= 1);
  check('admin roadmaps manage', (await a.req('GET', '/api/v1/roadmaps/admin/all')).data?.length >= 17);
  const sus = await a.req('PATCH', `/api/v1/admin/users/${studentForAssign._id}/status`, { status: 'suspended' });
  check('admin suspends user', sus.status === 200, sus);
  check('admin re-activates user', (await a.req('PATCH', `/api/v1/admin/users/${studentForAssign._id}/status`, { status: 'active' })).status === 200);
  const am = await a.req('POST', '/api/v1/meetings', { title: 'Smoke seminar for everyone', startAt: new Date(Date.now() + 864e5).toISOString(), audience: { type: 'all' }, mode: 'external', externalUrl: 'https://meet.google.com/abc-defg-hij' });
  check('admin schedules session for all', am.status === 201, am);
  check('external session needs URL', (await a.req('POST', '/api/v1/meetings', { title: 'No link', startAt: new Date(Date.now() + 864e5).toISOString(), audience: { type: 'all' }, mode: 'external' })).status === 400);


  // ---------------- new admin CRUD: roadmaps bulk, communities, user edit, student create, AI keys
  const bulkRes = await a.req('POST', '/api/v1/roadmaps/admin/bulk', { mode: 'upsert', roadmaps: [
    { title: 'Smoke Bulk One', category: 'Technology', summary: 's', phases: [{ title: 'P1', duration: '1w', steps: [{ key: 'a-step', title: 'A step', description: '', isProject: false, resources: [{ title: 'MDN', url: 'https://developer.mozilla.org/', type: 'doc', free: true }] }] }] },
    { title: 'Smoke Bulk Two', category: 'Design', phases: [{ title: 'P1', steps: [{ key: 'b-step', title: 'B step' }] }] },
  ] });
  check('bulk roadmap import creates both', bulkRes.data?.results?.filter((r) => r.status === 'created').length === 2, bulkRes);
  const bulkAgain = await a.req('POST', '/api/v1/roadmaps/admin/bulk', { mode: 'create', roadmaps: [{ title: 'Smoke Bulk One', category: 'Technology', phases: [{ title: 'Phase', steps: [{ key: 'zz', title: 'zz' }] }] }] });
  check('bulk import skips existing in create-only mode', bulkAgain.data?.results?.[0]?.status === 'skipped', bulkAgain);
  check('bulk import rejects invalid category', (await a.req('POST', '/api/v1/roadmaps/admin/bulk', { roadmaps: [{ title: 'Bad', category: 'Nope', phases: [{ title: 'P', steps: [{ key: 'zz', title: 'zz' }] }] }] })).status === 400);
  check('student cannot bulk import', [401, 403].includes((await s.req('POST', '/api/v1/roadmaps/admin/bulk', { roadmaps: [] })).status));

  const nc = await a.req('POST', '/api/v1/communities', { name: `Smoke Admin Community ${Date.now()}`, description: 'x', tags: ['t'] });
  check('admin creates community', nc.status === 201, nc);
  const cid = nc.data?._id;
  check('admin edits community (tags, track)', (await a.req('PATCH', `/api/v1/communities/${cid}`, { description: 'updated', tags: ['a', 'b'], track: 'data-analytics' })).data?.description === 'updated');
  const cd = await a.req('GET', `/api/v1/communities/${cid}`);
  check('admin reads community chat conversation', Boolean(cd.data?.conversation), cd);
  check('admin reads community messages without joining', (await a.req('GET', `/api/v1/chat/conversations/${cd.data?.conversation}/messages`)).status === 200);
  const postMsg = await a.req('POST', `/api/v1/chat/conversations/${cd.data?.conversation}/messages`, { text: 'Admin moderation hello' });
  check('admin can post in community chat', postMsg.status === 201, postMsg);
  check('student cannot delete a community', [401, 403].includes((await s.req('DELETE', `/api/v1/communities/${cid}`)).status));
  const delC = await a.req('DELETE', `/api/v1/communities/${cid}`);
  check('admin deletes community and its chat', delC.status === 200, delC);
  check('deleted community is gone', (await a.req('GET', `/api/v1/communities/${cid}`)).status === 404);

  const upd = await a.req('PATCH', `/api/v1/admin/users/${mentorAny._id}`, { headline: 'Edited by admin', mentorProfile: { company: 'Edited Co', experienceYears: 8 } });
  check('admin edits a mentor', upd.status === 200, upd);
  const mview = await a.req('GET', `/api/v1/admin/users/${mentorAny._id}`);
  check('mentor record view has profile + mentees', mview.data?.user?.mentorProfile?.company === 'Edited Co' && Array.isArray(mview.data?.mentees), mview);
  const newStudent = await a.req('POST', '/api/v1/admin/students', { name: 'Walk In Student', email: `walkin.${Date.now()}@example.com`, education: { degree: 'BBA', college: 'Test College', graduationYear: 2027 } });
  check('admin adds a student via invite', newStudent.status === 201 && newStudent.data?.inviteLink, newStudent);

  const keyBefore = await a.req('GET', '/api/v1/admin/ai/keys');
  check('AI keys listing (masked)', Array.isArray(keyBefore.data) && keyBefore.data.length === 3, keyBefore);
  const fakeKey = 'gsk_smoketest_' + Date.now() + 'ABCDEFGH';
  const addKey = await a.req('POST', '/api/v1/admin/ai/keys', { provider: 'groq', key: fakeKey, label: 'smoke' });
  const groqNow = addKey.data?.find((x) => x.provider === 'groq');
  check('admin adds an API key (stored, masked)', addKey.status === 201 && groqNow?.keys?.some((k) => k.tail === fakeKey.slice(-4)) && !JSON.stringify(addKey).includes(fakeKey), addKey);
  check('duplicate API key rejected', (await a.req('POST', '/api/v1/admin/ai/keys', { provider: 'groq', key: fakeKey })).status === 409);
  check('short API key rejected', (await a.req('POST', '/api/v1/admin/ai/keys', { provider: 'groq', key: 'abc' })).status === 400);
  check('provider pool now lists the new key', (await a.req('GET', '/api/v1/admin/ai')).data?.providers?.find((x) => x.provider === 'groq')?.configured === true);
  check('admin removes the API key', (await a.req('DELETE', `/api/v1/admin/ai/keys/groq/${groqNow.keys[0].id}`)).status === 200);
  check('student cannot read AI keys', [401, 403].includes((await s.req('GET', '/api/v1/admin/ai/keys')).status));


  // ---------------- assessments: admin tests + student attempts + practice
  const tplRes = await a.req('GET', '/api/v1/admin/tests/template.xlsx', null, { raw: true });
  const tplBuf = Buffer.from(await tplRes.arrayBuffer());
  check('Excel template downloads (.xlsx)', tplRes.status === 200 && tplBuf.subarray(0, 2).toString() === 'PK', tplRes.status);
  const parseRes = await fetch(BASE + '/api/v1/admin/tests/parse-excel', { method: 'POST', headers: { authorization: 'Bearer ' + a.token, 'content-type': 'application/octet-stream' }, body: tplBuf });
  const tparsed = await parseRes.json();
  check('template parses back into 3 questions with no errors', tparsed.data?.questions?.length === 3 && tparsed.data.errors.length === 0, tparsed);
  check('tparsed correct answer + marks mapped', tparsed.data?.questions?.[0]?.correct === 1 && tparsed.data?.questions?.[2]?.marks === 2, tparsed.data?.questions);
  const tjunk = await (await fetch(BASE + '/api/v1/admin/tests/parse-excel', { method: 'POST', headers: { authorization: 'Bearer ' + a.token, 'content-type': 'application/octet-stream' }, body: Buffer.from('not a spreadsheet') })).json();
  check('invalid upload gives a friendly error', tjunk.data?.errors?.length >= 1 && tjunk.data.questions.length === 0, tjunk);
  const aiGen = await a.req('POST', '/api/v1/admin/tests/generate-questions', { topic: 'Operating systems', count: 5 });
  check('AI question generation without keys → clear 503', aiGen.status === 503 && /AI|Excel/i.test(aiGen.error?.message || ''), aiGen);
  const topts = await a.req('GET', '/api/v1/admin/tests/audience-options');
  check('audience options listed', topts.data?.degrees?.includes('B.Tech') && topts.data?.tracks?.length > 0, topts);
  const tprev = await a.req('POST', '/api/v1/admin/tests/audience-preview', { audience: { degrees: ['b.tech'] } });
  check('audience preview counts matching students (case-insensitive)', tprev.data?.count >= 2, tprev);

  const tnow = Date.now();
  const mkTest = (over = {}) => ({ title: 'Smoke Test ' + Math.random().toString(36).slice(2, 6), description: 'd', startAt: new Date(tnow - 60_000).toISOString(), endAt: new Date(tnow + 3_600_000).toISOString(), durationMinutes: 30, passPercent: 50, maxAttempts: 1, questions: tparsed.data.questions, status: 'published', audience: {}, ...over });
  const badWindow = await a.req('POST', '/api/v1/admin/tests', mkTest({ endAt: new Date(tnow - 120_000).toISOString() }));
  check('test rejects end before start', badWindow.status === 400, badWindow);
  check('cannot publish without questions', (await a.req('POST', '/api/v1/admin/tests', mkTest({ questions: [] }))).status === 400);
  const tcreated = await a.req('POST', '/api/v1/admin/tests', mkTest({ audience: { degrees: ['B.Tech'] } }));
  check('admin publishes a scheduled test', tcreated.status === 201 && /notified/.test(tcreated.message), tcreated);
  const tid = tcreated.data?._id;
  const tother = await a.req('POST', '/api/v1/admin/tests', mkTest({ audience: { degrees: ['MBA'] }, title: 'MBA only' }));
  const tfuture = await a.req('POST', '/api/v1/admin/tests', mkTest({ startAt: new Date(tnow + 7_200_000).toISOString(), endAt: new Date(tnow + 10_800_000).toISOString(), title: 'Future test' }));

  const sx = new Client();
  await sx.login(env.SEED_STUDENT_EMAIL, env.SEED_STUDENT_PASSWORD); // a B.Tech student
  const tlist = await sx.req('GET', '/api/v1/tests');
  const tmine = tlist.data?.find((x) => x._id === tid);
  check('student sees the test assigned to their degree', tmine?.state === 'open' && tmine.questionCount === 3, tlist);
  check('student does NOT see a test for another degree', !tlist.data?.some((x) => x._id === tother.data?._id));
  check('upcoming test is listed as upcoming', tlist.data?.find((x) => x._id === tfuture.data?._id)?.state === 'upcoming');
  check('cannot start a test that has not opened', (await sx.req('POST', '/api/v1/tests/' + tfuture.data._id + '/start')).error?.code === 'NOT_STARTED');
  check('cannot start a test outside the audience', (await sx.req('POST', '/api/v1/tests/' + tother.data._id + '/start')).status === 404);

  const tst = await sx.req('POST', '/api/v1/tests/' + tid + '/start');
  const tqs = tst.data?.questions || [];
  check('start returns questions WITHOUT correct answers', tst.status === 200 && tqs.length === 3 && tqs.every((q) => !('correct' in q) && !('explanation' in q)), tst);
  const attemptId = tst.data?.attempt?._id;
  const tagain = await sx.req('POST', '/api/v1/tests/' + tid + '/start');
  check('starting tagain resumes the same attempt (same order)', tagain.data?.attempt?._id === attemptId && JSON.stringify(tagain.data.questions.map((q) => q._id)) === JSON.stringify(tqs.map((q) => q._id)));
  const byText = Object.fromEntries(tparsed.data.questions.map((q) => [q.text, q.correct]));
  const tAnswers = Object.fromEntries(tqs.map((q, i) => [q._id, i === 0 ? byText[q.text] : (byText[q.text] + 1) % q.options.length])); // first right, others wrong
  check('autosave stores answers', (await sx.req('PUT', '/api/v1/tests/attempts/' + attemptId + '/answers', { answers: tAnswers })).data?.saved === 3);
  check('autosave rejects invalid ids', (await sx.req('PUT', '/api/v1/tests/attempts/' + attemptId + '/answers', { answers: { notanid: 1 } })).status === 400);
  const tsub = await sx.req('POST', '/api/v1/tests/attempts/' + attemptId + '/submit', {});
  const expectedScore = tparsed.data.questions.find((q) => q.text === tqs[0].text).marks;
  check('submit grades the attempt', tsub.status === 200 && tsub.data?.score === expectedScore && tsub.data?.review?.length === 3, tsub);
  check('review reveals correct answers after submit', tsub.data?.review?.every((r) => typeof r.correct === 'number'));
  check('second submit is idempotent', (await sx.req('POST', '/api/v1/tests/attempts/' + attemptId + '/submit', {})).data?.score === tsub.data?.score);
  check('attempt limit enforced', (await sx.req('POST', '/api/v1/tests/' + tid + '/start')).error?.code === 'NO_ATTEMPTS_LEFT');
  check('results history lists the attempt', (await sx.req('GET', '/api/v1/tests/results/me')).data?.some((r) => r._id === attemptId));
  check('another student cannot read my attempt', (await (async () => { const o = new Client(); await o.login('diya@careersaathi.test', env.SEED_STUDENT_PASSWORD); return o.req('GET', '/api/v1/tests/attempts/' + attemptId); })()).status === 404);

  const tres = await a.req('GET', '/api/v1/admin/tests/' + tid + '/results');
  check('admin results: stats + per-question analysis', tres.data?.stats?.submissions === 1 && tres.data?.perQuestion?.length === 3 && tres.data.attempts[0].user?.email, tres);
  const xr = await a.req('GET', '/api/v1/admin/tests/' + tid + '/results.xlsx', null, { raw: true });
  check('results export (.xlsx)', xr.status === 200 && Buffer.from(await xr.arrayBuffer()).subarray(0, 2).toString() === 'PK');
  const tlocked = await a.req('PUT', '/api/v1/admin/tests/' + tid, { ...mkTest({ audience: { degrees: ['B.Tech'] } }), title: 'Renamed', questions: [tparsed.data.questions[0]] });
  check('questions are locked once students have attempted', tlocked.status === 200 && /locked/.test(tlocked.message), tlocked);
  const tdup = await a.req('POST', '/api/v1/admin/tests/' + tid + '/duplicate');
  check('admin duplicates a test as draft', tdup.status === 201, tdup);
  check('admin deletes a test with its attempts', (await a.req('DELETE', '/api/v1/admin/tests/' + tdup.data._id)).status === 200 && (await a.req('DELETE', '/api/v1/admin/tests/' + tid)).message.includes('1 attempt'));
  check('students cannot use admin test routes', (await sx.req('GET', '/api/v1/admin/tests')).status === 403);

  // expiry: a window that has just closed
  const tclosing = await a.req('POST', '/api/v1/admin/tests', mkTest({ title: 'Closed', startAt: new Date(tnow - 7_200_000).toISOString(), endAt: new Date(tnow - 3_600_000).toISOString() }));
  check('closed test cannot be started', (await sx.req('POST', '/api/v1/tests/' + tclosing.data._id + '/start')).error?.code === 'TEST_CLOSED');

  // practice (no AI keys → confidence check from the roadmap)
  const popts = await sx.req('GET', '/api/v1/practice/options');
  check('practice options tlist my roadmaps', popts.data?.roadmaps?.length >= 1 && popts.data.aiAvailable === false, popts);
  const pgen = await sx.req('POST', '/api/v1/practice/generate', { roadmapId: popts.data.roadmaps[0]._id, phaseIndex: 0, count: 5 });
  check('practice falls back to a confidence check without AI', pgen.status === 201 && pgen.data?.kind === 'confidence' && pgen.data.questions.length > 0 && pgen.data.notice, pgen);
  const tratings = pgen.data.questions.map((_, i) => (i % 2 ? 4 : 1));
  const tpsub = await sx.req('POST', '/api/v1/practice/' + pgen.data._id + '/submit', { answers: tratings });
  check('confidence check scored with weak topics', tpsub.status === 200 && tpsub.data?.percent > 0 && tpsub.data.weakTopics.length > 0, tpsub);
  check('practice cannot be submitted twice', (await sx.req('POST', '/api/v1/practice/' + pgen.data._id + '/submit', { answers: tratings })).status === 409);
  const phist = await sx.req('GET', '/api/v1/practice/history');
  check('practice history + per-roadmap progress', phist.data?.items?.length >= 1 && phist.data.roadmaps?.[0]?.attempts >= 1, phist);
  check('practice with no roadmap and no AI → helpful error', (await sx.req('POST', '/api/v1/practice/generate', { topic: 'Python', count: 5 })).status === 503);
  check('practice review reopens later', (await sx.req('GET', '/api/v1/practice/' + pgen.data._id)).data?.review?.length === pgen.data.questions.length);
  await a.req('DELETE', '/api/v1/admin/tests/' + tclosing.data._id);
  await a.req('DELETE', '/api/v1/admin/tests/' + tother.data._id);
  await a.req('DELETE', '/api/v1/admin/tests/' + tfuture.data._id);

  console.log(`\n${results.join('\n')}\n\n${passed} passed, ${failed} failed  (${BASE})`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((err) => {
  console.error(`\n${results.join('\n')}\n\nSmoke test crashed:`, err);
  process.exitCode = 1;
});
