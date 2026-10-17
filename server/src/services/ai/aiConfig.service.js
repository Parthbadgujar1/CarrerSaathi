/**
 * Runtime AI configuration = keys/models from .env  +  keys/models saved by admins in the portal.
 * Portal keys are encrypted at rest (AES-256-GCM) and never returned to the browser — only a masked tail.
 * The merged config is cached in memory so the hot path (keyPool) stays synchronous.
 */
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { Setting } from '../../models/index.js';
import { encrypt, decrypt } from '../crypto.service.js';
import { ApiError } from '../../utils/ApiError.js';

export const PROVIDERS = ['groq', 'gemini', 'openai'];

let dbKeys = { groq: [], gemini: [], openai: [] }; // [{ id, label, enc, last4, addedAt }]
let dbModels = {};
let decrypted = { groq: [], gemini: [], openai: [] };

const rebuild = () => {
  decrypted = Object.fromEntries(PROVIDERS.map((p) => [p, (dbKeys[p] || []).map((k) => decrypt(k.enc)).filter(Boolean)]));
};

/** Loads portal-managed settings from MongoDB. Safe to call repeatedly. */
export async function loadAiConfig() {
  try {
    const rows = await Setting.find({ key: { $in: ['aiKeys', 'aiModels'] } }).lean();
    const keys = rows.find((r) => r.key === 'aiKeys')?.value || {};
    dbKeys = Object.fromEntries(PROVIDERS.map((p) => [p, Array.isArray(keys[p]) ? keys[p] : []]));
    dbModels = rows.find((r) => r.key === 'aiModels')?.value || {};
    rebuild();
  } catch (err) {
    logger.warn('Could not load AI config from database', { message: err.message });
  }
}

/** Merged view used by the key pool and the provider callers. */
export function getProviderConfig(provider) {
  const base = env.ai[provider] || { keys: [], model: '' };
  const keys = [...new Set([...(decrypted[provider] || []), ...base.keys])];
  return { keys, model: dbModels[provider] || base.model };
}

export const getAiOrder = () => env.ai.order.filter((p) => PROVIDERS.includes(p));

/** Masked listing for the admin UI. */
export function listKeys() {
  return PROVIDERS.map((provider) => ({
    provider,
    model: dbModels[provider] || env.ai[provider]?.model,
    defaultModel: env.ai[provider]?.model,
    envKeys: (env.ai[provider]?.keys || []).map((k) => ({ tail: k.slice(-4) })),
    keys: (dbKeys[provider] || []).map((k) => ({ id: k.id, label: k.label, tail: k.last4, addedAt: k.addedAt })),
  }));
}

async function persist(userId) {
  await Setting.bulkWrite([
    { updateOne: { filter: { key: 'aiKeys' }, update: { $set: { value: dbKeys, updatedBy: userId } }, upsert: true } },
    { updateOne: { filter: { key: 'aiModels' }, update: { $set: { value: dbModels, updatedBy: userId } }, upsert: true } },
  ]);
  rebuild();
}

export async function addKey(provider, rawKey, label, userId) {
  if (!PROVIDERS.includes(provider)) throw ApiError.badRequest('Unknown provider.');
  const key = String(rawKey).trim();
  if (key.length < 12 || /\s/.test(key)) throw ApiError.badRequest('That does not look like a valid API key.', [{ field: 'key', message: 'Check the key and paste it again' }]);
  const all = [...(decrypted[provider] || []), ...(env.ai[provider]?.keys || [])];
  if (all.includes(key)) throw ApiError.conflict('This key is already added.');
  dbKeys[provider].push({ id: crypto.randomBytes(6).toString('hex'), label: String(label || '').slice(0, 40), enc: encrypt(key), last4: key.slice(-4), addedAt: new Date() });
  await persist(userId);
}

export async function removeKey(provider, id, userId) {
  const before = dbKeys[provider]?.length || 0;
  dbKeys[provider] = (dbKeys[provider] || []).filter((k) => k.id !== id);
  if (dbKeys[provider].length === before) throw ApiError.notFound('Key not found.');
  await persist(userId);
}

export async function setModels(models, userId) {
  for (const p of PROVIDERS) if (typeof models[p] === 'string') dbModels[p] = models[p].trim() || undefined;
  dbModels = Object.fromEntries(Object.entries(dbModels).filter(([, v]) => v));
  await persist(userId);
}
