/**
 * Environment configuration.
 * All configuration lives in environment variables (see .env.example) and is
 * validated once at boot so the rest of the code can trust `env`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(__dirname, '../..');

// Node >= 20.12 ships a native .env loader, so no dotenv dependency is needed.
const envFile = process.env.ENV_FILE || path.join(SERVER_ROOT, '.env');
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const csv = (value) =>
  (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const bool = (fallback) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

// Railway: derive sensible defaults from the variables the platform injects, so a fresh deploy needs fewer settings.
if (process.env.RAILWAY_PUBLIC_DOMAIN && !process.env.CLIENT_URL) process.env.CLIENT_URL = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
if (!process.env.MONGODB_URI && (process.env.MONGO_URL || process.env.MONGO_PRIVATE_URL)) process.env.MONGODB_URI = process.env.MONGO_URL || process.env.MONGO_PRIVATE_URL;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  APP_NAME: z.string().default('CareerSaathi'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  SERVE_CLIENT: bool(true),

  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/careersaathi'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  REFRESH_TTL_REMEMBER_DAYS: z.coerce.number().int().positive().default(30),
  DATA_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'DATA_ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: bool(true),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  LOG_TO_FILE: bool(!process.env.RAILWAY_ENVIRONMENT_ID),
  MAIL_FROM: z.string().default('CareerSaathi <no-reply@localhost>'),
  BUSINESS_NAME: z.string().default('SkillNexGen'),
  BUSINESS_ADDRESS: z.string().default(''),
  SUPPORT_EMAIL: z.string().default(''),

  AI_PROVIDER_ORDER: z.string().default('groq,gemini,openai'),
  GROQ_API_KEYS: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  GEMINI_API_KEYS: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  OPENAI_API_KEYS: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(25000),
  AI_CACHE_TTL_DAYS: z.coerce.number().int().positive().default(30),

  JITSI_DOMAIN: z.string().default('meet.jit.si'),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  LOAD_SHED_LAG_MS: z.coerce.number().int().positive().default(250),

  SEED_ADMIN_NAME: z.string().default('Platform Admin'),
  SEED_ADMIN_EMAIL: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  SEED_MENTOR_EMAIL: z.string().optional(),
  SEED_MENTOR_PASSWORD: z.string().optional(),
  SEED_STUDENT_EMAIL: z.string().optional(),
  SEED_STUDENT_PASSWORD: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // Logger is not available yet (it depends on env), so print directly.
  console.error('\n[config] Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('Copy server/.env.example to server/.env and fill in the values.\n');
  process.exit(1);
}

const raw = parsed.data;

// Production refuses to boot with placeholder secrets or an insecure public URL.
if (raw.NODE_ENV === 'production') {
  const problems = [];
  if (/change-me|example|secret/i.test(raw.JWT_ACCESS_SECRET)) problems.push('JWT_ACCESS_SECRET still looks like a placeholder');
  if (/^0+$/.test(raw.DATA_ENCRYPTION_KEY)) problems.push('DATA_ENCRYPTION_KEY is all zeros — generate a real 32-byte hex key');
  if (!raw.CLIENT_URL.startsWith('https://')) problems.push('CLIENT_URL must be an https:// URL in production');
  if (problems.length) {
    console.error('\n[config] Unsafe production configuration:');
    problems.forEach((p) => console.error(`  - ${p}`));
    process.exit(1);
  }
}

export const env = Object.freeze({
  ...raw,
  isProd: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: csv(raw.CORS_ORIGINS).length ? csv(raw.CORS_ORIGINS) : [raw.CLIENT_URL],
  ai: {
    order: csv(raw.AI_PROVIDER_ORDER).map((p) => p.toLowerCase()),
    groq: { keys: csv(raw.GROQ_API_KEYS), model: raw.GROQ_MODEL },
    gemini: { keys: csv(raw.GEMINI_API_KEYS), model: raw.GEMINI_MODEL },
    openai: { keys: csv(raw.OPENAI_API_KEYS), model: raw.OPENAI_MODEL },
    timeoutMs: raw.AI_TIMEOUT_MS,
    cacheTtlDays: raw.AI_CACHE_TTL_DAYS,
  },
  smtpConfigured: Boolean((raw.SMTP_HOST && raw.SMTP_USER && raw.SMTP_PASS) || raw.RESEND_API_KEY),
  resendConfigured: Boolean(raw.RESEND_API_KEY),
  paths: {
    root: SERVER_ROOT,
    logs: path.join(SERVER_ROOT, 'storage', 'logs'),
    mail: path.join(SERVER_ROOT, 'storage', 'mail'),
    clientDist: path.resolve(SERVER_ROOT, '..', 'client', 'dist'),
  },
});
