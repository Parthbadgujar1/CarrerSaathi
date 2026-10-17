export const ROLES = Object.freeze({ STUDENT: 'student', MENTOR: 'mentor', ADMIN: 'admin' });
export const ROLE_LIST = Object.values(ROLES);

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  PENDING: 'pending', // mentor applications awaiting approval / invited mentors
  SUSPENDED: 'suspended',
  DELETION_PENDING: 'deletion_pending',
});

export const OPPORTUNITY_TYPES = ['job', 'internship', 'hackathon', 'competition', 'scholarship', 'workshop', 'event'];
export const OPPORTUNITY_SOURCES = [
  'skillnexgen',
  'internsaathi',
  'naukrisaathi',
  'kaushalsaathi',
  'unstop',
  'indeed',
  'linkedin',
  'college',
  'other',
];
export const APPLICATION_STATUSES = ['saved', 'applied', 'interview', 'offer', 'rejected'];
export const MEETING_TYPES = ['seminar', 'workshop', 'guidance', 'mentoring', 'webinar', 'mock-interview'];

export const DEGREE_LEVELS = ['Diploma', 'UG', 'PG', 'PhD', 'Other'];

export const ROADMAP_CATEGORIES = [
  'Technology',
  'Data & AI',
  'Design',
  'Management',
  'Commerce & Finance',
  'Core Engineering',
  'Creative & Media',
  'Public Sector',
];

/** Version strings of the legal documents users consent to. Bump when the text changes. */
export const LEGAL_VERSIONS = Object.freeze({ terms: '2026-10-01', privacy: '2026-10-01' });

export const DELETION_GRACE_DAYS = 7;
export const MAX_COMMUNITIES_PER_STUDENT = 3;
