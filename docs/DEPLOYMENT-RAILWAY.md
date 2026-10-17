# Deploying CareerSaathi on Railway

One Railway service (the `Dockerfile` at the repo root) serves the API, Socket.IO and the built React app on a single HTTPS domain, plus one MongoDB service. Same origin means no CORS setup and the secure refresh cookie just works.

## 1. Create the project
1. Push this repo to GitHub (`.env` files are git-ignored — never commit them).
2. Railway → **New Project → Deploy from GitHub repo**. It detects `railway.json` and builds the Dockerfile.
3. In the same project: **+ New → Database → MongoDB**.

## 2. Variables (service → Variables)
| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | `${{MongoDB.MONGO_URL}}` (reference to the Mongo service; the app also falls back to `MONGO_URL` automatically). Append `/careersaathi?authSource=admin` if your URL has no database name |
| `JWT_ACCESS_SECRET` | 64+ random characters — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DATA_ENCRYPTION_KEY` | 64 hex chars — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **Back it up**: it encrypts stored AI keys; losing it means re-entering them |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME` | First admin, created on first boot only if no admin exists. Change the password after login, then delete `SEED_ADMIN_PASSWORD` |
| `RESEND_API_KEY`, `MAIL_FROM` | Email over HTTPS (recommended — Railway blocks outbound SMTP on non-Pro plans). `MAIL_FROM` must use a domain verified in Resend, e.g. `CareerSaathi <no-reply@yourdomain.com>`. Or set `SMTP_*` on the Pro plan |
| `BUSINESS_NAME`, `BUSINESS_ADDRESS`, `SUPPORT_EMAIL` | Shown on legal pages and emails |
| `GROQ_API_KEYS`, `GEMINI_API_KEYS`, `OPENAI_API_KEYS` | Optional, comma-separated (many keys rotate automatically). You can also add keys later in **Admin → System → AI** without redeploying |

Set automatically (no action): `PORT`, `CLIENT_URL` (from `RAILWAY_PUBLIC_DOMAIN`; set it yourself if you add a custom domain), `TRUST_PROXY=1` default matches Railway's single proxy hop, file logging is off (logs go to Railway's log viewer).

The server **refuses to start** in production with placeholder secrets, an all-zero encryption key or a non-https `CLIENT_URL`.

## 3. Domain
Service → **Settings → Networking → Generate Domain** (or add a custom domain and set `CLIENT_URL=https://your.domain`). Redeploy after changing `CLIENT_URL`.

## 4. Verify
- Deploy logs show `CareerSaathi API listening` and `Installed 17 built-in roadmap(s)`.
- `https://<domain>/api/health/ready` → `status: ok`, database `connected`.
- Sign in with the seed admin. Send a test via Admin → Mentors → add mentor and check the email arrives.

## Operating notes
- **Replicas:** keep `numReplicas: 1`. Socket.IO presence and the background jobs (email outbox, test auto-submit, reminders) run in-process; scaling out needs a Redis adapter first.
- **Backups:** enable Railway's volume backups on the MongoDB service (or run `mongodump` on a schedule). Student data is personal data.
- **Deploys:** every push to the linked branch redeploys; Railway keeps the old instance until `/api/health` passes. Graceful shutdown (SIGTERM) is handled.
- **Seed demo data** is intentionally not part of production. Never run `npm run seed:reset` against the production database.
