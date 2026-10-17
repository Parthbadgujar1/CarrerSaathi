import { z } from 'zod';
import { name, phone, text, stringList, optionalUrl } from '../../utils/schemas.js';
import { DEGREE_LEVELS } from '../../config/constants.js';

export const updateProfileSchema = z.object({
  name: name.optional(),
  phone: phone.optional(),
  headline: text(140).optional(),
  bio: text(1000).optional(),
  education: z
    .object({
      level: z.enum(DEGREE_LEVELS).optional(),
      degree: text(80).optional(),
      branch: text(80).optional(),
      college: text(160).optional(),
      university: text(160).optional(),
      graduationYear: z.coerce.number().int().min(1990).max(2100).optional(),
      currentYear: z.coerce.number().int().min(1).max(6).optional(),
      cgpa: z.coerce.number().min(0).max(10).optional(),
    })
    .optional(),
  address: z
    .object({
      line1: text(200).optional(),
      city: text(80).optional(),
      state: text(80).optional(),
      pincode: z.string().trim().regex(/^(\d{6})?$/, 'PIN code must be 6 digits').optional(),
      country: text(60).optional(),
    })
    .optional(),
  careerTracks: stringList(5, 80).optional(),
  skills: stringList(40, 50).optional(),
  interests: stringList(20, 50).optional(),
  links: z
    .object({
      linkedin: optionalUrl,
      github: optionalUrl,
      portfolio: optionalUrl,
      codingProfile: optionalUrl,
      resumeUrl: optionalUrl,
    })
    .optional(),
  mentorProfile: z
    .object({
      designation: text(100).optional(),
      company: text(120).optional(),
      expertise: stringList(10).optional(),
      experienceYears: z.coerce.number().int().min(0).max(60).optional(),
      maxMentees: z.coerce.number().int().min(1).max(200).optional(),
      availability: text(200).optional(),
    })
    .optional(),
});

export const preferencesSchema = z.object({
  marketingEmails: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  wellnessShareWithMentor: z.boolean().optional(),
});

export const deletionSchema = z.object({
  password: z.string().min(1, 'Password is required').max(128),
  reason: text(500).optional().default(''),
});

export const unsubscribeSchema = z.object({ token: z.string().regex(/^[a-f\d]{48}$/i, 'Invalid link') });
