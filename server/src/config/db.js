import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);
// Fail fast instead of buffering queries for a long time while the DB is down;
// the dbGuard middleware turns this into a clean 503 for API callers.
mongoose.set('bufferTimeoutMS', 5000);

let retryTimer = null;
let listenersAttached = false;

function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected — driver will keep retrying'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB error', { message: err.message }));
}

/**
 * Connects to MongoDB. If the first attempt fails the API keeps running in a
 * degraded mode (health endpoint + static site + 503s) and retries in the
 * background, so a database outage never takes the whole process down.
 */
export async function connectDB({ retry = true } = {}) {
  attachListeners();
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 20,
      minPoolSize: 2,
      autoIndex: !env.isProd,
    });
    return true;
  } catch (err) {
    logger.error('MongoDB initial connection failed', { message: err.message });
    if (retry) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => connectDB({ retry: true }), 10_000);
      retryTimer.unref();
    }
    return false;
  }
}

export function isDbReady() {
  return mongoose.connection.readyState === 1;
}

export async function disconnectDB() {
  clearTimeout(retryTimer);
  await mongoose.connection.close(false);
}
