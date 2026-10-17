# CareerSaathi API reference (v1)

Base URL: `/api/v1`. JSON in, JSON out.

- **Success:** `{ "success": true, "data": …, "message"?: "…" }`
- **Error:** `{ "success": false, "error": { "code", "message", "details"?: [{ field, message }], "requestId" } }`
- **Auth:** send `Authorization: Bearer <accessToken>` (15-minute JWT). Refresh with `POST /auth/refresh`, which uses the httpOnly
  `cs_rt` cookie and requires the header `X-Requested-With: XMLHttpRequest`.
- **Paginated lists** take `?page&limit` and return `{ items, pagination: { page, limit, total, pages } }`.
- **Role tags** below: 🎓 student · 🧭 mentor · 🛡 admin · 🌐 public.

## Health
| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Liveness (never touches the DB) |
| GET | `/api/health/ready` | Database, email, AI, realtime and process checks. Returns `503` when the DB is down |

## Auth `/auth`
| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/register` | 🌐 | Student sign-up. `consents.terms` must be `true`. `utm` is optional |
| POST | `/mentor-apply` | 🌐 | Mentor application (pending until an admin approves) |
| POST | `/login` | 🌐 | `{ email, password, remember }`. Locks for 15 min after 5 failures |
| POST | `/refresh` · `/logout` | cookie | Rotating refresh token |
| POST | `/logout-all` | any | Revokes every session |
| GET | `/me` | any | Current user |
| POST | `/forgot-password` · `/reset-password` | 🌐 | Reset link is single-use and valid for 30 min |
| POST | `/verify-email` · `/resend-verification` | 🌐 / any | |
| POST | `/accept-invite` | 🌐 | Activates an invited mentor or admin |
| POST | `/change-password` | any | Returns a fresh access token; signs out other devices |

## Users `/users`
`PATCH /me` (profile) · `PATCH /me/preferences` · `GET /me/sessions` · `DELETE /me/sessions/:id` · `GET /me/export` (JSON download) ·
`POST /me/deletion` `{ password, reason }` · `POST /unsubscribe` `{ token }` 🌐

## Students `/students` 🎓
`GET /me/dashboard` · `GET|PUT /me/career-kit` · `GET|PUT /me/resume` · `GET /me/mentor-notes`

## Roadmaps `/roadmaps`
| Method | Path | Who |
|---|---|---|
| GET | `/` `?q&category` · `/:slug` · `/quiz` | 🌐 (`/:slug` adds progress and skill gap when signed in) |
| GET | `/me/enrollments` | any |
| POST | `/recommend` `{ answers }` | any |
| POST | `/generate` `{ fields[], level, hoursPerWeek, timelineMonths, goal, forceAI }` | any. Response `source` is `library`, `cache` or `ai` |
| POST | `/save-draft` `{ draftKey }` | 🎓 |
| POST / DELETE | `/:id/enroll` | 🎓 |
| PATCH | `/:id/steps` `{ key, done }` | 🎓 |
| GET / POST / PUT / DELETE | `/admin/all`, `/admin`, `/admin/:id` | 🛡 |

## AI `/ai`
`POST /chat` `{ message, history[] }` → `{ reply, source: ai|cache|rules }` · `GET /quota`

## Opportunities `/opportunities`
`GET /` `?q&type&source&track&forMe&page` · `GET /:id` · `GET /external` · `GET /applications/me` 🎓 ·
`PUT|DELETE /:id/application` 🎓 `{ status: saved|applied|interview|offer|rejected, notes }` ·
`GET /manage` 🧭🛡 · `POST /` · `PUT /:id` · `DELETE /:id` 🧭🛡 (mentors can change only their own posts)

## Sessions `/meetings`
`GET /` `?when=upcoming|past&hosted` · `GET /:id` (join details open 15 min before the start) · `POST /:id/rsvp` ·
`POST /` · `PUT /:id` · `POST /:id/cancel` 🧭🛡.
Audiences: `all`, `students`, `mentors`, `tracks`, `mentees`, `users`. Mentors cannot target `all` or `mentors`.

## Mentorship `/mentorship`
`GET /mentors` 🎓 · `POST /requests` 🎓 · `GET /mine` · `POST /:id/respond` 🧭 · `POST /:id/end` ·
`GET /students` `?scope=mine|all` 🧭 · `GET /students/:id` 🧭 · `POST /students/:id/notes` 🧭 · `PATCH|DELETE /notes/:id`

## Chat `/chat`
`GET /conversations` · `POST /direct` `{ userId }` (allowed once a mentorship is active, or for admins) ·
`GET /conversations/:id/messages` `?before` · `POST /conversations/:id/messages` (REST fallback) · `POST /conversations/:id/read` · `DELETE /messages/:id`

Socket.IO (same origin, `auth: { token }`):
- client → server: `chat:join`, `chat:leave`, `chat:send` (with ack), `chat:typing`
- server → client: `chat:message`, `chat:deleted`, `chat:typing`, `notification:new`

## Communities `/communities`
`GET /` `?q&track&joined&status` · `POST /` · `GET /:id` · `POST /:id/join` · `POST /:id/leave` · `PATCH /:id` (moderator or 🛡)

## Wellness `/wellness` 🎓
`GET /` `?days` · `PUT /today` · `GET /resources`

## Notifications `/notifications`
`GET /` · `GET /unread-count` · `POST /read-all` · `POST /:id/read`

## Admin `/admin` 🛡
| Area | Endpoints |
|---|---|
| Dashboard | `GET /stats` |
| Students & users | `GET /students` (filters: `q`, `college`, `degree`, `track`, `graduationYear`, `status`, `verified`, `from`, `to`, `sort`) · `GET /students/export-fields` · `POST /students/export` `{ filters, fields[], ids[] }` → `.xlsx` · `GET /users/:id` · `PATCH /users/:id/status` · `DELETE /users/:id` · `POST /mentorships` (assign mentor) |
| Mentors & admins | `GET /mentors` · `POST /mentors` (invite) · `POST /mentors/:id/approve` · `POST /mentors/:id/reject` · `POST /users/:id/resend-invite` · `POST /admins` |
| Settings | `GET|PATCH /settings` · `POST /announcements` |
| Records | `GET /audit-logs` · `GET|PATCH /contact-messages` · `GET /deletion-requests` · `POST /deletion-requests/:id/process` · `GET /emails` · `POST /emails/:id/retry` |
| AI | `GET /ai` · `POST /ai/test` · `DELETE /ai/cache` |

## Public `/public` 🌐
`GET /stats` · `GET /config` · `POST /contact` (honeypot, rate-limited) · `GET /search?q`

## Error codes (selection)
`VALIDATION_ERROR` 400 · `UNAUTHORIZED` / `TOKEN_EXPIRED` / `SESSION_REVOKED` 401 · `FORBIDDEN` / `ACCOUNT_PENDING` / `CSRF` 403 ·
`NOT_FOUND` / `ROUTE_NOT_FOUND` 404 · `DUPLICATE` 409 · `PAYLOAD_TOO_LARGE` 413 · `ACCOUNT_LOCKED` 423 · `RATE_LIMITED` 429 ·
`DB_UNAVAILABLE` / `SERVER_BUSY` / `TIMEOUT` 503

## Tests, assessments & practice

### Student (`/api/v1/tests`, `/api/v1/practice`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/tests` | Tests assigned to me (state: upcoming/open/closed, attempts left, best score) |
| POST | `/tests/:id/start` | Start or resume an attempt (server-owned deadline; answers never sent) |
| PUT | `/tests/attempts/:id/answers` | Autosave answers (`{answers:{questionId:choice\|null}}`) |
| POST | `/tests/attempts/:id/submit` | Grade and finish (idempotent); review follows the test's `showResults` policy |
| GET | `/tests/attempts/:id` | Resume payload while in progress, result afterwards |
| GET | `/tests/results/me` | My score history |
| GET | `/practice/options` | Roadmaps I follow + whether AI quizzes are available |
| POST | `/practice/generate` | AI quiz for a roadmap/phase/topic; falls back to a 1–5 confidence check without AI/quota |
| POST | `/practice/:id/submit`, GET `/practice/:id`, GET `/practice/history` | Score, review, per-roadmap trend |

### Admin (`/api/v1/admin/tests`)
`GET /template.xlsx` · `POST /parse-excel` (raw `.xlsx` bytes, `?format=csv` for CSV; preview only) · `POST /generate-questions` (AI; uses every configured key with automatic rotation) · `GET /audience-options` · `POST /audience-preview` · CRUD `GET|POST /`, `GET|PUT|DELETE /:id`, `PATCH /:id/status`, `POST /:id/duplicate` · `GET /:id/results` · `GET /:id/results.xlsx`.

Audience filters (degree, graduation year, current year, college, career track) combine with AND; empty means all active students. Questions are locked once any student has attempted. Expired attempts are auto-submitted by a background job.
