/**
 * Field-level encryption (AES-256-GCM) for sensitive free text such as
 * private wellness journal entries. Even someone with DB read access cannot
 * read the plaintext without DATA_ENCRYPTION_KEY.
 */
import crypto from 'node:crypto';
import { env } from '../config/env.js';

const KEY = Buffer.from(env.DATA_ENCRYPTION_KEY, 'hex');
const PREFIX = 'enc:v1:';

export function encrypt(plain) {
  if (plain === undefined || plain === null || plain === '') return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, data]).toString('base64');
}

export function decrypt(value) {
  if (!value || typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
  try {
    const buf = Buffer.from(value.slice(PREFIX.length), 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}
