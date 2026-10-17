import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestId, requestLogger } from './middleware/requestContext.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { loadShedding, requestTimeout } from './middleware/resilience.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import healthRoutes from './modules/health/health.routes.js';
import v1 from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY); // correct client IPs behind Hostinger / Nginx proxy
  app.set('query parser', 'simple');

  app.use(requestId);
  app.use(requestLogger);

  // ---- Security headers (strict CSP — the SPA ships no inline scripts) ----
  const jitsi = `https://${env.JITSI_DOMAIN}`;
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", jitsi],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:'],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'", 'ws:', 'wss:'],
          'frame-src': ["'self'", jitsi],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"],
          'object-src': ["'none'"],
          'upgrade-insecure-requests': env.isProd ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: env.isProd ? { maxAge: 31536000, includeSubDomains: true } : false,
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(self "https://' + env.JITSI_DOMAIN + '"), microphone=(self "https://' + env.JITSI_DOMAIN + '"), geolocation=(), payment=()');
    next();
  });

  app.use(
    cors({
      origin(origin, cb) {
        // Same-origin and server-to-server requests have no Origin header.
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        return cb(new Error('CORS_NOT_ALLOWED'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
      maxAge: 600,
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '200kb' }));
  app.use(express.urlencoded({ extended: false, limit: '50kb' }));
  app.use(cookieParser());
  app.use(sanitizeInput);

  // Health checks bypass load shedding and the DB guard so monitors always get an answer.
  app.use('/api/health', healthRoutes);

  app.use('/api', loadShedding, requestTimeout(30_000), apiLimiter);
  app.use('/api/v1', v1);
  app.use('/api', notFound);

  // ---- Serve the built React app (single-origin deployment on Hostinger) ----
  const indexHtml = path.join(env.paths.clientDist, 'index.html');
  if (env.SERVE_CLIENT && fs.existsSync(indexHtml)) {
    app.use(
      express.static(env.paths.clientDist, {
        index: false,
        maxAge: '1y',
        immutable: true,
        setHeaders(res, file) {
          if (!file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=300');
        },
      }),
    );
    // SPA fallback: unknown paths render the app, whose router shows the custom 404 page.
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  } else {
    app.get('/', (_req, res) => res.json({ name: 'CareerSaathi API', docs: '/api/health', client: env.CLIENT_URL }));
  }

  app.use(errorHandler);
  return app;
}
