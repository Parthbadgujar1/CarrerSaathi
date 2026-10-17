# CareerSaathi — career readiness, mentorship & wellbeing platform

CareerSaathi (a SkillNexGen initiative) helps every graduation student — B.Tech, B.Sc, B.Com, BBA, BA, M.Tech, MBA and more — close the
industry–academia gap with personalised roadmaps, an industry-readiness score, a career kit (resume, LinkedIn, GitHub/portfolio),
opportunities, mentors, communities, live sessions and wellbeing tools. Admins monitor registrations and progress and export records
to Excel; mentors track and guide their mentees.

**Stack:** React 19 + Vite · Node.js 20+/Express 5 · MongoDB (Mongoose 9) · Socket.IO · deployable on Hostinger (VPS or Node.js hosting).

**Brand & theme:** a teal-and-ink theme modelled on uorapublications.com, keeping the original CareerSaathi green.

- **Colours:** teal `#0e7c77` for pill-shaped call-to-action buttons, deep ink `#061727` for text, the dark bands and the footer, and mint/cyan highlights.
- **Typography:** Inter throughout, with heavy headings and a wavy underline on highlighted words.
- **Layout:** a thin announcement bar, a frosted light header, an airy hero with soft glows and a faint grid, and white cards with teal icon tiles.
- **Portals:** a promotion section for the four Skill NexGen family portals — Skill NexGen, KaushalSaathi, InternSaathi and NaukriSaathi — in the card style used on internsaathi.com, with "Powered by Sunsys Techsol Pvt. Ltd." (sunsysglobal.com) underneath.
- **Theme:** the colour tokens are in `client/src/styles/tokens.css`.

---

## 1. Features

| Area | What's included |
|---|---|
| **Students** | Dashboard with readiness score, next steps, streaks · 17 curated roadmaps across tech, data, design, management, HR, finance, core engineering, writing and public sector · **AI roadmap planner** for any field *or combination* of fields · Career Compass quiz · skill-gap analysis · career-kit checklist · ATS-friendly **resume builder** (print → PDF) · opportunities feed matched to tracks · **application tracker** · deep links to Unstop / Indeed / LinkedIn / NCS + the four Skill NexGen family portals (Skill NexGen, KaushalSaathi, InternSaathi, NaukriSaathi) · live sessions with RSVP and in-portal video · mentor directory & requests · 1:1 chat · interest communities with group chat · **wellness**: daily check-in, encrypted journal, mood/sleep charts, box breathing, focus timer, helplines, gentle low-mood nudge · "Ask Saathi" AI counsellor |
| **Mentors** | Mentee overview, accept/decline requests, all-students view (privacy-reduced), per-student progress drawer (readiness, roadmaps, career kit, applications, wellness summary *only if the student consents*), goals/notes/feedback, chat, schedule sessions, post opportunities |
| **Admins** | Analytics (registrations, tracks, colleges, degrees, sources, readiness bands) · student records with filters, selection and **Excel export** with column picker · add/approve/reject/suspend mentors (secure invite links) · invite admins · assign mentors · sessions for everyone/students/mentors/tracks · opportunities, roadmap editor, community moderation, announcements · system health, AI provider status/testing/cache, runtime settings, contact inbox, data-deletion requests, email outbox, audit log |
| **Site & UX** | Minimal, professional theme · light/dark/system toggle (no flash) · sticky header · mobile menu · site search (Ctrl/⌘+K) · scroll progress bar · back-to-top · floating contact button · skeleton loaders & route progress · hover/focus states · copy buttons · print stylesheet · skip-to-content · password visibility toggle · form success/error states · confirmation modals · expandable FAQ · "last updated" dates · custom 404 · offline banner · error boundaries |
| **Privacy & compliance** | Cookie banner with equal-weight Accept/Reject + granular settings · Privacy Policy, Terms, Cookie Policy · explicit, unchecked consent boxes with recorded versions · first-party UTM attribution only with consent · unsubscribe links in announcement emails · download-my-data · account deletion with 7-day grace period · no ads, no third-party trackers, self-hosted fonts · no fake reviews or inflated counters (home page shows live counts) · no hidden fees |

## 2. Run it locally

**Prerequisites:** Node.js ≥ 20.12, MongoDB 6+ running locally (or a MongoDB Atlas URI).

```bash
# 1. install
cd server && npm install
cd ../client && npm install

# 2. configure (a ready-to-use local .env is already generated in server/.env)
#    otherwise: copy server/.env.example → server/.env and fill in the secrets

# 3. seed demo data (roadmaps, demo students, mentors, sessions, opportunities)
cd ../server && npm run seed:reset

# 4a. production-like: build the client once, then the API serves everything on :5000
cd ../client && npm run build
cd ../server && npm start            # → http://localhost:5000

# 4b. or development with hot reload (two terminals)
cd server && npm run dev             # API on :5000
cd client && npm run dev             # app on :5173 (proxies /api and /socket.io)
```

On Windows you can also run **`start-local.ps1`** from the project root. It starts the project's MongoDB (data on `D:\CareerSaathiData`),
the API and the web app.

> **Note for this machine:** the C: drive was almost full, so MongoDB refused to build indexes (it needs 500 MB free).
> The project therefore uses its own MongoDB process on **port 27018** with data in `D:\CareerSaathiData\db`
> (`MONGODB_URI` in `server/.env`). Your installed MongoDB service on 27017 was not touched.

### Demo logins
All demo accounts and their passwords are the `SEED_*` values in **`server/.env`**:

| Role | Email variable | Password variable |
|---|---|---|
| Admin | `SEED_ADMIN_EMAIL` | `SEED_ADMIN_PASSWORD` |
| Mentor | `SEED_MENTOR_EMAIL` (also `mentor.data@…`, `mentor.hr@…`) | `SEED_MENTOR_PASSWORD` |
| Student | `SEED_STUDENT_EMAIL` (also `diya@`, `kabir@`, `meera@`, `rohan@`, `sara@`, `arjun@`, `ishita@careersaathi.test`) | `SEED_STUDENT_PASSWORD` |

Emails (verification, reset, invites, announcements) are written to `server/storage/mail/*.html` in development, and the link is logged in the
server console, so every email flow can be tested without SMTP.

## 3. Project structure

```
CarrerSaathi/
├── server/                      Node.js + Express 5 API
│   ├── src/
│   │   ├── server.js            bootstrap, graceful shutdown, process guards
│   │   ├── app.js               middleware pipeline, security headers, static SPA
│   │   ├── config/              env (validated with zod), db, logger, constants
│   │   ├── middleware/          auth, rate limits, validation, sanitising, load shedding, DB guard, errors
│   │   ├── models/              Mongoose schemas + indexes
│   │   ├── modules/<feature>/   routes → controller → service per feature (auth, users, students, roadmaps,
│   │   │                        ai, opportunities, meetings, mentorship, chat, communities, wellness,
│   │   │                        notifications, admin, public, health)
│   │   ├── services/            ai/ (providers, key pool, fallback), email/ (outbox + templates),
│   │   │                        tokens, readiness, notifications, audit, settings, crypto, data rights
│   │   ├── sockets/             Socket.IO (chat, notifications)
│   │   ├── jobs/                background jobs (email retries, reminders, deletion purge, housekeeping)
│   │   ├── data/                curated roadmaps, quiz, counsellor rules, wellbeing resources
│   │   └── scripts/             seed, create-admin, bootstrap
│   ├── tests/smoke.mjs          110-check end-to-end test against a running server
│   └── storage/                 logs/ and dev mail/ (git-ignored)
├── client/                      React 19 + Vite SPA
│   └── src/
│       ├── app/                 App, routes (code-split), React Query client
│       ├── components/          ui/ (design-system primitives), layout/, common/, charts/, chat/,
│       │                        roadmap/, opportunities/, meetings/, profile/
│       ├── pages/               public/, auth/, student/, mentor/, admin/, shared/
│       ├── services/            API layer (one place for every endpoint)
│       ├── store/               Zustand stores (auth, theme, consent, UI)
│       ├── lib/                 http client (token refresh), socket, utm, formatting, storage
│       ├── hooks/               focus trap, debounce, forms, scroll, online status…
│       ├── config/site.js       business details (from client/.env)
│       └── styles/              tokens (light/dark), base, components, layout, print
└── docs/                        DEPLOYMENT-HOSTINGER.md, API.md
```

Conventions: business logic lives in server services and client `services/` + hooks; UI components stay presentational. Files are
`PascalCase.jsx` for components, `camelCase.js` for modules, `<feature>.routes|controller|service|validation.js` on the server.
Configuration lives only in `.env` files (never in code).

## 4. AI integration & cost control

Providers: **Groq**, **Google Gemini** and **OpenAI**, called over plain REST (no vendor SDKs). Configure any of them, with **multiple keys
per provider** (comma-separated) in `server/.env`:

```
AI_PROVIDER_ORDER=groq,gemini,openai
GROQ_API_KEYS=key1,key2
GEMINI_API_KEYS=key1
OPENAI_API_KEYS=key1
```

How requests are resolved (cheapest first):

1. **Library first** — a single field that matches a curated roadmap is served from the library (free, instant).
2. **Shared cache** — inputs are normalised and bucketed (hours/week, timeline), so similar requests from different students hit a 30-day
   MongoDB cache. Counsellor answers to first questions are cached too.
3. **Daily quota** per user (admin-configurable), plus per-user rate limiting.
4. **Providers in order**, with round-robin key rotation and a **circuit breaker** per key (invalid key → parked 1 h; rate-limited →
   parked for `Retry-After`; repeated errors → parked 30 s). Prompts are compact, output tokens are capped, JSON output is validated,
   and links outside a list of reputable learning sites are dropped (no hallucinated URLs).
5. **Fallback that never fails** — if no key works (or AI is switched off), the planner blends the best curated roadmaps for each
   requested field, and the counsellor answers from a built-in rule set. Crisis messages always get helpline information first.

The admin **System → AI** tab shows provider/key health, test buttons, the share of requests served free, and a cache reset.
Model names are configurable (`GROQ_MODEL`, `GEMINI_MODEL`, `OPENAI_MODEL`). Check each provider's current model list before deploying.

## 5. Security

- Passwords hashed with bcrypt (cost 12). Password policy is enforced on the server. Accounts lock for 15 minutes after 5 failed logins. Login errors are generic, so they don't reveal whether an account exists.
- Short-lived JWT access tokens (15 min, memory only) plus **rotating refresh tokens** in an httpOnly, SameSite=Strict cookie, stored hashed. Reuse of an old refresh token is detected and revokes the session. Users can see their devices and sign out one or all of them. Changing or resetting a password revokes other sessions.
- Single-use, hashed, expiring tokens for email verification (48 h), password reset (30 min) and invites (72 h).
- Role-based access control on every route. Mentors see a privacy-reduced student view. Private chats are visible only to their participants.
- zod validation on every request, NoSQL-injection and prototype-pollution sanitising, parameter-pollution guard, 200 KB body limit, and escaped regex search.
- Helmet with a strict CSP (no inline scripts), HSTS in production, `frame-ancestors 'none'`, a Permissions-Policy, and a CORS allow-list. A custom-header CSRF guard protects the cookie endpoints.
- Rate limits: a global limit, plus separate limits for login, registration, sensitive account actions, the contact form and AI.
- Wellness journals are encrypted at rest with AES-256-GCM.
- An audit log records privileged admin actions such as exports, deletions, settings changes and invites.
- Secrets are redacted from logs. Stack traces are never sent to clients; every error carries a request ID for tracing.
- `npm audit`: **0 known vulnerabilities** in production dependencies.

## 6. Resilience ("one failure must not take everything down")

| Failure | Behaviour |
|---|---|
| MongoDB down at start or later | The server still starts and serves the website and health checks. API calls return a clean `503 DB_UNAVAILABLE` (no hanging), and the connection retries automatically. **Tested:** the platform recovered on its own about 8 s after the DB came back. |
| AI providers down, slow, or out of quota | Circuit breakers skip bad keys and fall back to the curated library or rules. Students always get a plan. |
| Email/SMTP down | A transactional outbox queues mail and retries with exponential backoff (up to 5 attempts). Requests never wait on email. |
| Realtime (WebSocket) blocked | Chat sends over REST, and threads and notifications fall back to polling. |
| Overload | Load shedding returns `503` + `Retry-After` when event-loop lag passes a threshold. Rate limits, request timeouts and HTTP slowloris timeouts also apply. |
| Bug in one page or widget | React error boundaries contain the crash to that page or section. API errors show friendly retry states. |
| Process crash | Unhandled rejections are logged without crashing. Uncaught exceptions trigger a graceful exit and PM2 restarts the process. SIGTERM shuts down cleanly. |

Health endpoints: `GET /api/health` (liveness) and `GET /api/health/ready` (database, email, AI, realtime, memory and event-loop lag).

## 7. Database indexing

Every collection is indexed for its query patterns:

- Unique: user email, roadmap slug, refresh-token hash, and the one-per-pair records (enrolment per user and roadmap, application per user and opportunity, mentorship per student and mentor, community membership, daily wellness log).
- Compound: role/status/created date for admin lists; status/deadline for opportunities; conversation/created date for messages; user/read/created date for notifications.
- Text: for search.
- **TTL indexes** clean up expired sessions and tokens, plus old notifications, AI cache and logs, email logs, contact messages and audit logs.

## 8. Testing

```bash
cd server
npm run seed:reset      # fresh demo data
npm start               # in another terminal
npm run smoke           # 110 end-to-end checks across every role and module
```

The smoke suite covers:

- **Auth:** register, verify, login, lockout, refresh rotation, CSRF guard, logout, password reset/change, deletion and restore.
- **Access & validation:** role checks, validation errors, NoSQL-injection rejection, honeypot.
- **Student features:** roadmaps, AI generation with fallback, quiz, opportunities and tracker, sessions and RSVP, chat, communities, wellness encryption, career kit, resume, data export.
- **Mentor workflows** and **admin features**, including Excel export validation, invites, approvals, settings and announcements.

## 9. Before going live — please update

1. **Business details:** `client/.env` defaults to Skill NexGen with `support@skillnexgen.com` (the support address published on skillnexgen.com). Add the confirmed address, phone and grievance officer, and mirror them in `server/.env` (`BUSINESS_*`, `SUPPORT_EMAIL`, `MAIL_FROM`).
2. **Ecosystem links:** pre-filled with the official URLs taken from the sites' own navigation — skillnexgen.com, kaushalsaathi.com, internsaathi.com and naukrisaathi.com — the only four portals promoted anywhere in the app. Sunsys Techsol (sunsysglobal.com) appears only as the "Powered by" parent company. Admins can change the URLs in **Admin → System → Settings**.
3. **Legal review:** the Privacy Policy, Terms and Cookie Policy are written for India's DPDP Act 2023 principles, but have them reviewed by a qualified professional.
4. **Fonts and icons:** Inter (SIL Open Font License, self-hosted via @fontsource) and Lucide icons (ISC). No images need licensing.
5. **Secrets and SMTP:** generate fresh secrets for production, configure SMTP, and remove or replace the `SEED_*` demo accounts.

See **[docs/DEPLOYMENT-HOSTINGER.md](docs/DEPLOYMENT-HOSTINGER.md)** for step-by-step hosting and **[docs/API.md](docs/API.md)** for the API reference.
#   C a r r e r S a a t h i  
 