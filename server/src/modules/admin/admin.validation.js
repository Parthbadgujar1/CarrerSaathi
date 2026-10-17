import { z } from 'zod';
import { email, name, phone, objectId, text, stringList, optionalUrl, pagination } from '../../utils/schemas.js';

export const STUDENT_EXPORT_FIELDS = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  emailVerified: 'Email verified',
  status: 'Status',
  degreeLevel: 'Level',
  degree: 'Degree',
  branch: 'Branch / Specialisation',
  college: 'College',
  university: 'University',
  currentYear: 'Current year',
  graduationYear: 'Graduation year',
  cgpa: 'CGPA',
  addressLine: 'Address',
  city: 'City',
  state: 'State',
  pincode: 'PIN code',
  careerTracks: 'Career tracks',
  skills: 'Skills',
  readinessScore: 'Readiness score',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  utmSource: 'Signup source',
  registeredAt: 'Registered on',
  lastActiveAt: 'Last active',
};

export const studentsQuery = z.object({
  ...pagination,
  q: text(100).optional(),
  college: text(160).optional(),
  degree: text(80).optional(),
  track: text(80).optional(),
  graduationYear: z.coerce.number().int().min(1990).max(2100).optional(),
  status: z.enum(['active', 'suspended', 'deletion_pending']).optional(),
  verified: z.enum(['true', 'false']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sort: z.enum(['newest', 'oldest', 'name', 'readiness', 'active']).default('newest'),
});

/** Export is a POST so large selections of ids don't hit URL length limits. */
export const exportSchema = z.object({
  filters: studentsQuery.omit({ page: true, limit: true }).partial().default({}),
  fields: z
    .array(z.enum(Object.keys(STUDENT_EXPORT_FIELDS)))
    .min(1, 'Choose at least one column')
    .default(Object.keys(STUDENT_EXPORT_FIELDS)),
  ids: z.array(objectId).max(50_000).default([]),
});

export const statusSchema = z.object({ status: z.enum(['active', 'suspended']), reason: text(300).optional() });

export const createMentorSchema = z.object({
  name,
  email,
  phone: phone.optional().default(''),
  headline: text(140).optional().default(''),
  bio: text(1000).optional().default(''),
  linkedin: optionalUrl,
  mentorProfile: z.object({
    designation: text(100, 2),
    company: text(120, 2),
    expertise: stringList(10).refine((a) => a.length > 0, 'Add at least one area of expertise'),
    experienceYears: z.coerce.number().int().min(0).max(60),
    maxMentees: z.coerce.number().int().min(1).max(200).default(25),
    availability: text(200).optional().default(''),
  }),
});

export const createAdminSchema = z.object({ name, email });

export const mentorsQuery = z.object({ ...pagination, status: z.enum(['active', 'pending', 'suspended']).optional(), q: text(100).optional() });

export const assignSchema = z.object({ studentId: objectId, mentorId: objectId });

export const settingsSchema = z.object({
  registrationOpen: z.boolean().optional(),
  mentorApplicationsOpen: z.boolean().optional(),
  aiEnabled: z.boolean().optional(),
  aiDailyLimitStudent: z.coerce.number().int().min(0).max(500).optional(),
  aiDailyLimitStaff: z.coerce.number().int().min(0).max(2000).optional(),
  announcementBanner: text(240).optional(),
  ecosystemLinks: z
    .object({
      skillnexgen: optionalUrl,
      kaushalsaathi: optionalUrl,
      internsaathi: optionalUrl,
      naukrisaathi: optionalUrl,
    })
    .optional(),
});

export const announcementSchema = z
  .object({
    title: text(140, 3),
    body: text(2000, 5),
    audience: z.enum(['all', 'students', 'mentors', 'track']),
    track: text(80).optional(),
    sendEmail: z.boolean().default(false),
  })
  .refine((d) => d.audience !== 'track' || d.track, { message: 'Choose a career track', path: ['track'] });

export const listQuery = z.object({ ...pagination, status: text(30).optional() });
export const providerSchema = z.object({ provider: z.enum(['groq', 'gemini', 'openai']) });

export const aiKeySchema = z.object({
  provider: z.enum(['groq', 'gemini', 'openai']),
  key: z.string().trim().min(12, 'That does not look like a valid API key').max(400),
  label: text(40).optional().default(''),
});
export const aiModelsSchema = z.object({ groq: text(80).optional(), gemini: text(80).optional(), openai: text(80).optional() });
export const keyParams = z.object({ provider: z.enum(['groq', 'gemini', 'openai']), keyId: z.string().regex(/^[a-f0-9]{12}$/) });

export const updateUserSchema = z.object({
  name: name.optional(),
  phone: phone.optional(),
  headline: text(140).optional(),
  bio: text(1000).optional(),
  education: z
    .object({
      degree: text(80).optional(),
      branch: text(80).optional(),
      college: text(160).optional(),
      university: text(160).optional(),
      graduationYear: z.coerce.number().int().min(1990).max(2100).optional(),
      currentYear: z.coerce.number().int().min(1).max(6).optional(),
    })
    .optional(),
  address: z.object({ line1: text(200).optional(), city: text(80).optional(), state: text(80).optional(), pincode: text(10).optional() }).optional(),
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

export const createStudentSchema = z.object({
  name,
  email,
  phone: phone.optional().default(''),
  education: z.object({ degree: text(80, 2), branch: text(80).optional().default(''), college: text(160, 2), graduationYear: z.coerce.number().int().min(1990).max(2100) }),
});
