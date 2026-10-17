import { z } from 'zod';
import { email, password, name, phone, text, stringList, optionalUrl } from '../../utils/schemas.js';
import { DEGREE_LEVELS } from '../../config/constants.js';

const utm = z
  .object({
    utmSource: text(100).optional(),
    utmMedium: text(100).optional(),
    utmCampaign: text(100).optional(),
    referrer: text(300).optional(),
    landingPage: text(300).optional(),
  })
  .optional();

const consents = z.object({
  terms: z.literal(true, { error: 'You must accept the Terms of Service and Privacy Policy' }),
  marketingEmails: z.boolean().default(false),
});

export const registerSchema = z.object({
  name,
  email,
  password,
  phone: phone.optional().default(''),
  education: z.object({
    level: z.enum(DEGREE_LEVELS).default('UG'),
    degree: text(80, 2),
    branch: text(80).optional().default(''),
    college: text(160, 2),
    graduationYear: z.coerce.number({ error: 'Select your graduation year' }).int().min(1990, 'Select your graduation year').max(2100),
    currentYear: z.coerce.number().int().min(1).max(6).optional(),
  }),
  careerTracks: stringList(5, 80).optional().default([]),
  consents,
  utm,
});

export const mentorApplySchema = z.object({
  name,
  email,
  password,
  phone: phone.optional().default(''),
  mentorProfile: z.object({
    designation: text(100, 2),
    company: text(120, 2),
    expertise: stringList(10).refine((a) => a.length > 0, 'Add at least one area of expertise'),
    experienceYears: z.coerce.number().int().min(0).max(60),
    availability: text(200).optional().default(''),
  }),
  bio: text(1000).optional().default(''),
  linkedin: optionalUrl,
  consents,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(128),
  remember: z.boolean().optional().default(false),
});

export const emailOnlySchema = z.object({ email });
export const tokenSchema = z.object({ token: z.string().min(20).max(200) });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password });
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: password,
});
