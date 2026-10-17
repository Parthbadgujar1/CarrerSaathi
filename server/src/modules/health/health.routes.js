import { Router } from 'express';
import mongoose from 'mongoose';
import { isDbReady } from '../../config/db.js';
import { getEventLoopLag } from '../../middleware/resilience.js';
import { emailHealth } from '../../services/email/email.service.js';
import { configuredProviders } from '../../services/ai/keyPool.js';
import { isSocketReady } from '../../sockets/io.js';

const router = Router();

/** Liveness — the process is up. Used by uptime monitors and PM2/Hostinger checks. */
router.get('/', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()), time: new Date().toISOString() });
});

/** Readiness — every subsystem and whether it is degraded (never throws). */
router.get('/ready', async (_req, res) => {
  const mem = process.memoryUsage();
  let email = { transport: 'unknown' };
  try {
    email = await emailHealth();
  } catch {
    /* reported as unknown */
  }
  const db = isDbReady();
  const checks = {
    database: { ok: db, state: mongoose.STATES[mongoose.connection.readyState] },
    email: { ok: email.lastDelivery?.ok !== false, ...email },
    ai: { ok: true, providersConfigured: configuredProviders(), fallback: 'curated library + rules (always available)' },
    realtime: { ok: isSocketReady() },
    process: {
      ok: getEventLoopLag() < 250,
      eventLoopLagMs: getEventLoopLag(),
      rssMB: Math.round(mem.rss / 1048576),
      heapUsedMB: Math.round(mem.heapUsed / 1048576),
      uptimeSeconds: Math.round(process.uptime()),
      node: process.version,
    },
  };
  const status = !db ? 'down' : Object.values(checks).every((c) => c.ok) ? 'ok' : 'degraded';
  res.status(db ? 200 : 503).json({ status, checks });
});

export default router;
