import http from 'node:http';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createApp } from './app.js';
import { initSockets } from './sockets/index.js';
import { startJobs, stopJobs } from './jobs/scheduler.js';
import { ensureLibrary } from './scripts/bootstrap.js';
import { loadAiConfig } from './services/ai/aiConfig.service.js';

const app = createApp();
const server = http.createServer(app);

// Defensive HTTP timeouts (slowloris protection, stuck clients).
server.requestTimeout = 60_000;
server.headersTimeout = 20_000;
server.keepAliveTimeout = 65_000;

const io = initSockets(server);

async function start() {
  server.listen(env.PORT, () => {
    logger.info(`CareerSaathi API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
  // The HTTP server starts even if MongoDB is down — health checks and the
  // static site keep working while the DB connection retries in the background.
  mongoose.connection.on('connected', () => {
    loadAiConfig();
    ensureLibrary().catch((err) => logger.error('Library bootstrap failed', { message: err.message }));
  });
  await connectDB();
  startJobs();
}

let shuttingDown = false;
async function shutdown(signal, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down gracefully`);
  const force = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
  force.unref();
  try {
    stopJobs();
    io?.close();
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  } catch (err) {
    logger.error('Error during shutdown', { message: err.message });
  } finally {
    process.exit(code);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  // Logged, not fatal: a single failed promise must not take the platform down.
  logger.error('Unhandled promise rejection', { message: reason?.message || String(reason), stack: reason?.stack });
});
process.on('uncaughtException', (err) => {
  // State may be corrupt — log, exit cleanly, and let PM2/Hostinger restart the process.
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  shutdown('uncaughtException', 1);
});

start();
