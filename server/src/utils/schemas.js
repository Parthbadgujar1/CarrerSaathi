/** Shared zod building blocks for request validation. */
import { z } from 'zod';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParam = z.object({ id: objectId });

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(160)
  .pipe(z.email('Enter a valid email address'));

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const name = z
  .string()
  .trim()
  .min(2, 'Name is too short')
  .max(80)
  .regex(/^[\p{L}\p{M} .'-]+$/u, 'Name can only contain letters, spaces, dots, apostrophes and hyphens');

export const phone = z
  .string()
  .trim()
  .max(20)
  .regex(/^[+\d][\d\s-]{6,18}$/, 'Enter a valid phone number')
  .or(z.literal(''));

export const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https?:\/\/[^\s]+$/i.test(v), 'Must be a valid http(s) URL')
  .optional();

export const text = (max, min = 0) =>
  z
    .string({ error: 'This field is required' })
    .trim()
    .min(min, min <= 2 ? 'This field is required' : `Must be at least ${min} characters`)
    .max(max, `Must be at most ${max} characters`);

export const stringList = (maxItems, maxLen = 60) =>
  z
    .array(z.string().trim().min(1).max(maxLen))
    .max(maxItems)
    .transform((arr) => [...new Set(arr)]);

export const pagination = {
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

export const boolish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');
