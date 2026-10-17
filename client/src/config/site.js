/**
 * Public site configuration. Business details come from client/.env
 * (VITE_* variables) so they can be changed without touching code.
 * Ecosystem URLs were verified from skillnexgen.com, kaushalsaathi.com and naukrisaathi.com.
 */
const e = import.meta.env;

export const SITE = Object.freeze({
  name: 'CareerSaathi',
  tagline: 'Your companion from classroom to career',
  company: e.VITE_BUSINESS_NAME || 'Skill NexGen',
  poweredBy: e.VITE_POWERED_BY || 'Sunsys Techsol Pvt. Ltd.',
  address: e.VITE_BUSINESS_ADDRESS || '',
  email: e.VITE_CONTACT_EMAIL || '',
  phone: e.VITE_CONTACT_PHONE || '',
  grievanceOfficer: e.VITE_GRIEVANCE_OFFICER || '',
  url: e.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : ''),
  // Bump when the legal text changes; shown as "Last updated" on each page.
  legalUpdated: '2026-10-01',
  helpline: { name: 'Tele-MANAS', number: '14416', alt: '1-800-891-4416' },
  social: [
    { label: 'Skill NexGen on LinkedIn', url: 'https://www.linkedin.com/company/skillnexgen/' },
  ],
});

/**
 * The four Skill NexGen family portals — the only platforms CareerSaathi promotes —
 * in the order a student's journey usually flows. Copy is drawn from each portal's own site.
 */
export const ECOSYSTEM = [
  {
    key: 'skillnexgen',
    label: 'Skill NexGen',
    name: 'Skill',
    accent: 'NexGen',
    step: 'Learn',
    blurb: 'Industry-focused courses with projects, certificates and mentors.',
    kicker: 'Skill NexGen — learn the skills',
    title: 'From curiosity to capability',
    description:
      'Practical learning pathways that help students gain industry-relevant skills, build portfolios and become career-ready — beginner-friendly programmes with hands-on projects and mentor guidance.',
    points: ['Industry-focused curriculum', 'Hands-on projects & certificates', 'Internship and career support'],
    cta: 'Explore Skill NexGen',
    url: 'https://www.skillnexgen.com/',
  },
  {
    key: 'kaushalsaathi',
    label: 'KaushalSaathi',
    name: 'Kaushal',
    accent: 'Saathi',
    step: 'Train',
    blurb: 'Live, mentor-led job-ready training with real projects.',
    kicker: 'KaushalSaathi — live, mentor-led training',
    title: 'From skills to job-ready',
    description:
      'Learn through live classes with industry experts, work on real-world projects and build a career-ready portfolio — across data, development, design, marketing, HR and more.',
    points: ['Live classes with industry experts', 'Real-world projects', 'Placement assistance & interview prep'],
    cta: 'Explore KaushalSaathi',
    url: 'https://www.kaushalsaathi.com/',
  },
  {
    key: 'internsaathi',
    label: 'InternSaathi',
    name: 'Intern',
    accent: 'Saathi',
    step: 'Intern',
    blurb: 'Internships that turn classroom learning into experience.',
    kicker: 'InternSaathi — your ultimate start',
    title: 'From classroom to corporate',
    description:
      'Where every college student begins their journey — connecting learners to verified internships, real mentorship and direct PPO pathways, turning ambition into opportunity.',
    points: ['Verified internships', 'Smart-matching process', 'PPO-ready experiences'],
    cta: 'Explore InternSaathi',
    url: 'https://www.internsaathi.com/',
  },
  {
    key: 'naukrisaathi',
    label: 'NaukriSaathi',
    name: 'Naukri',
    accent: 'Saathi',
    step: 'Get hired',
    blurb: 'Jobs for freshers and graduates with verified companies.',
    kicker: 'NaukriSaathi — the career launchpad',
    title: 'From learning to earning',
    description:
      'Helps students and graduates move from learning to earning — bridging the gap between internship experience and employment, and empowering every learner to become career-ready.',
    points: ['Verified jobs', 'Interview training', 'Zero-cost access for all'],
    cta: 'Visit NaukriSaathi',
    url: 'https://www.naukrisaathi.com/',
  },
];

/** Parent company — credited as "Powered by", not listed as a portal. */
export const PARENT = { name: 'Sunsys Techsol Pvt. Ltd.', url: 'https://sunsysglobal.com/' };

export const PUBLIC_NAV = [
  { to: '/#features', label: 'Features' },
  { to: '/roadmaps', label: 'Roadmaps' },
  { to: '/#network', label: 'Our network' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
];
