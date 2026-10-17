import fs from 'node:fs';
import path from 'node:path';
import winston from 'winston';
import { env } from './env.js';

if (env.LOG_TO_FILE) fs.mkdirSync(env.paths.logs, { recursive: true });

const SENSITIVE_KEYS = /pass(word)?|token|secret|authorization|cookie|api[-_]?key|journal/i;

/** Recursively masks values whose key looks sensitive so secrets never reach log files. */
function redact(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 4) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE_KEYS.test(k) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
}

const redactFormat = winston.format((info) => {
  const { level, message, timestamp, stack, ...meta } = info;
  return Object.assign(info, redact(meta));
});

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${message}${extra}${stack ? `\n${stack}` : ''}`;
  }),
);

const jsonFormat = winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json());

export const logger = winston.createLogger({
  level: env.isTest ? 'error' : env.LOG_LEVEL,
  format: winston.format.combine(winston.format.errors({ stack: true }), redactFormat()),
  transports: [
    new winston.transports.Console({ format: env.isProd ? jsonFormat : devFormat, silent: env.isTest }),
    ...(env.LOG_TO_FILE ? [
    new winston.transports.File({
      filename: path.join(env.paths.logs, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
    new winston.transports.File({
      filename: path.join(env.paths.logs, 'combined.log'),
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    })
    ] : []),
  ],
  exitOnError: false,
});
