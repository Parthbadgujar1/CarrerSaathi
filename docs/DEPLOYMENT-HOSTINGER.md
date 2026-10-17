# Deploying CareerSaathi on Hostinger

CareerSaathi deploys as **one Node.js app**: Express serves the API, Socket.IO and the built React site from the same origin. That
means one domain, no CORS setup and secure SameSite cookies by default.

You need:

- a domain (for example `careersaathi.yourdomain.com`)
- a MongoDB database:
  - **MongoDB Atlas** (recommended; the free M0 tier is fine to start, Mumbai region `ap-south-1`), or
  - MongoDB installed on a Hostinger VPS
- an email mailbox for sending (a Hostinger mailbox works: `smtp.hostinger.com`, port `465`, SSL)

There are two ways to host. **Option A (VPS)** gives full control and is recommended for production. **Option B (Hostinger's managed
Node.js hosting)** is simpler if your plan includes it.

---

## 0. Prepare the build (both options)

```bash
# on your computer
cd client && npm ci && npm run build      # creates client/dist
cd ../server && npm ci --omit=dev
```

Create `server/.env` for production. Start from `server/.env.example` and set at least these values:

```
NODE_ENV=production
PORT=5000
CLIENT_URL=https://careersaathi.yourdomain.com
CORS_ORIGINS=https://careersaathi.yourdomain.com
TRUST_PROXY=1
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/careersaathi?retryWrites=true&w=majority
JWT_ACCESS_SECRET=<node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
DATA_ENCRYPTION_KEY=<node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@yourdomain.com
SMTP_PASS=<mailbox password>
MAIL_FROM=CareerSaathi <no-reply@yourdomain.com>
BUSINESS_NAME=SkillNexGen
BUSINESS_ADDRESS=<registered address>
SUPPORT_EMAIL=support@yourdomain.com
SEED_ADMIN_EMAIL=<your admin email>
SEED_ADMIN_PASSWORD=<strong temporary password — change it after first login>
# optional AI keys
GROQ_API_KEYS=
GEMINI_API_KEYS=
OPENAI_API_KEYS=
```

> ⚠️ **Never reuse the development `.env`.** Generate new secrets. Back up `DATA_ENCRYPTION_KEY` safely: losing it makes the encrypted
> journal entries unreadable.

Also set the public business details in `client/.env` **before** running `npm run build` (they are compiled into the site).

On first start the server installs the 17 built-in roadmaps and creates the first admin from `SEED_ADMIN_*` (only if no admin exists).
Do **not** run `npm run seed` in production; it creates demo data.

---

## Option A — Hostinger VPS (Ubuntu 22.04/24.04)

### A1. Server basics
```bash
ssh root@YOUR_VPS_IP
adduser deploy && usermod -aG sudo deploy && su - deploy
sudo apt update && sudo apt -y upgrade
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

### A2. Node.js LTS + PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt -y install nodejs nginx
sudo npm i -g pm2
```

### A3. Database
- **Atlas (recommended):** create a cluster and a database user. Under *Network Access*, allow only your VPS IP. Put the connection string in `MONGODB_URI`.
- **Or local MongoDB on the VPS:** install MongoDB Community from the official docs, enable authentication, and keep it bound to `127.0.0.1` (never expose port 27017).

### A4. Upload the app
```bash
sudo mkdir -p /var/www/careersaathi && sudo chown deploy: /var/www/careersaathi
# from your computer (or git clone your repository):
rsync -av --exclude node_modules --exclude storage ./ deploy@YOUR_VPS_IP:/var/www/careersaathi/
# on the VPS:
cd /var/www/careersaathi/server && npm ci --omit=dev
cd ../client && npm ci && npm run build
nano /var/www/careersaathi/server/.env      # paste the production .env
```

### A5. Run with PM2
```bash
cd /var/www/careersaathi/server
pm2 start ecosystem.config.cjs --env production
pm2 save && pm2 startup systemd            # follow the printed command so it starts on reboot
pm2 install pm2-logrotate                  # rotate PM2 logs
```
The app runs as **one process** on purpose. Socket.IO rooms and rate-limit counters are kept in memory. To run several instances later,
add the Socket.IO Redis adapter and a Redis store for `express-rate-limit`, then increase `instances`.

### A6. Nginx reverse proxy (with WebSockets)
`/etc/nginx/sites-available/careersaathi`:
```nginx
server {
    server_name careersaathi.yourdomain.com;
    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;      # Socket.IO
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 75s;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/careersaathi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```
Point the domain's **A record** to the VPS IP in Hostinger hPanel → Domains → DNS.

### A7. HTTPS
```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d careersaathi.yourdomain.com     # auto-renews
```

### A8. Backups & monitoring
- Atlas: enable backups or snapshots. Self-hosted: add a nightly cron job, for example
  `0 2 * * * mongodump --uri="$MONGODB_URI" --archive=/var/backups/cs-$(date +\%F).gz --gzip`, and copy the archive off the server.
- Add an uptime monitor (for example UptimeRobot) on `https://careersaathi.yourdomain.com/api/health`.
- Logs: `pm2 logs`, plus `server/storage/logs/error.log` and `combined.log` (size-rotated).

### A9. Updating
```bash
cd /var/www/careersaathi && git pull       # or rsync again
cd client && npm ci && npm run build
cd ../server && npm ci --omit=dev && pm2 reload careersaathi
```

---

## Option B — Hostinger Node.js web app hosting (hPanel)

Some Hostinger plans (Business / Cloud at the time of writing) can host Node.js apps directly from hPanel. Check that your plan lists
**Node.js** support first.

1. Create the database on **MongoDB Atlas**, since shared hosting does not include MongoDB. Allow access from the hosting IP (or `0.0.0.0/0` with a strong password if the IP is not fixed).
2. Build locally: `cd client && npm run build`.
3. In hPanel, add a **Node.js app**. Upload the project (or connect your Git repository) with the app root at `server/` and the client build at `client/dist` next to it (the server serves `../client/dist`).
4. Set **Entry file:** `src/server.js` and **Node version:** 20 or newer.
5. Add every production environment variable from step 0 in the app's environment settings (or upload `server/.env`).
6. Start the app and attach your domain, with SSL enabled in hPanel.
7. Open `https://yourdomain/api/health/ready` — every check should report `ok`.

If WebSockets are not available on your plan, chat and notifications still work through the built-in REST and polling fallback.

---

## Post-deployment checklist

- [ ] `/api/health/ready` shows the database `ok` and the email transport `smtp`
- [ ] Sign in as the seeded admin, then **change the password** (Profile → Account & privacy)
- [ ] Admin → System → Settings: set the ecosystem URLs and AI limits; System → AI: press **Test** for each configured provider
- [ ] Send yourself a password-reset email to confirm SMTP delivery
- [ ] Review the Privacy Policy, Terms and Cookie Policy text and the business details in the footer
- [ ] Set up Atlas backups or the `mongodump` cron, and an uptime monitor
