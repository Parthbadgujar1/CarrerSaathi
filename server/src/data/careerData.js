/**
 * Static, zero-cost knowledge used by the rule-based engines:
 * career-kit checklist, career-compass quiz, offline counsellor answers,
 * wellbeing resources and external opportunity search links.
 */

/** Universal industry-readiness checklist (roadmaps add track-specific items). */
export const CORE_CAREER_KIT = [
  { key: 'resume', label: 'ATS-friendly one-page resume (built here or uploaded link)' },
  { key: 'linkedin', label: 'LinkedIn profile complete: photo, headline, about, skills' },
  { key: 'professionalEmail', label: 'Professional email ID (firstname.lastname@…)' },
  { key: 'projects', label: '2+ projects or case studies relevant to your track' },
  { key: 'certification', label: 'At least one recognised certification' },
  { key: 'elevatorPitch', label: 'Prepared a 60-second self-introduction' },
  { key: 'mockInterview', label: 'Completed at least one mock interview' },
  { key: 'networking', label: 'Connected with 25+ professionals in your field' },
];

/** Career Compass quiz — each option adds weight to roadmap slugs. */
export const QUIZ = [
  {
    id: 'enjoy',
    question: 'Which activity sounds most enjoyable to you?',
    options: [
      { id: 'build', label: 'Building apps or websites', weights: { 'full-stack-web-development': 3, 'mobile-app-development': 2 } },
      { id: 'data', label: 'Finding patterns in numbers and data', weights: { 'data-analytics': 3, 'data-science-ai': 2 } },
      { id: 'design', label: 'Designing how things look and feel', weights: { 'ui-ux-design': 3, 'content-technical-writing': 1 } },
      { id: 'people', label: 'Working with and helping people', weights: { 'human-resources': 3, 'product-management': 1 } },
      { id: 'business', label: 'Understanding business and money', weights: { 'finance-accounting': 3, 'business-analysis-consulting': 2 } },
      { id: 'machines', label: 'Working with machines, circuits or structures', weights: { 'mechanical-engineering-design': 2, 'electronics-embedded-vlsi': 2, 'civil-engineering': 2 } },
    ],
  },
  {
    id: 'subject',
    question: 'Which subject did you enjoy most?',
    options: [
      { id: 'cs', label: 'Computer science / programming', weights: { 'full-stack-web-development': 2, 'cloud-devops': 2, 'cybersecurity': 1 } },
      { id: 'math', label: 'Maths / statistics', weights: { 'data-science-ai': 3, 'data-analytics': 2 } },
      { id: 'physics', label: 'Physics / mechanics', weights: { 'mechanical-engineering-design': 3, 'civil-engineering': 1 } },
      { id: 'electronics', label: 'Electronics / electrical', weights: { 'electronics-embedded-vlsi': 3 } },
      { id: 'commerce', label: 'Accounts / economics', weights: { 'finance-accounting': 3, 'business-analysis-consulting': 1 } },
      { id: 'languages', label: 'Languages / arts / social science', weights: { 'content-technical-writing': 3, 'government-public-sector': 2, 'digital-marketing': 1 } },
    ],
  },
  {
    id: 'style',
    question: 'How do you prefer to work?',
    options: [
      { id: 'deep', label: 'Deep focus on technical problems', weights: { 'cybersecurity': 2, 'cloud-devops': 2, 'data-science-ai': 1 } },
      { id: 'creative', label: 'Creative and visual work', weights: { 'ui-ux-design': 2, 'digital-marketing': 2 } },
      { id: 'team', label: 'Coordinating teams and decisions', weights: { 'product-management': 3, 'human-resources': 1 } },
      { id: 'structured', label: 'Structured, rule-based work', weights: { 'finance-accounting': 2, 'government-public-sector': 2 } },
      { id: 'field', label: 'On-site / hands-on field work', weights: { 'civil-engineering': 3, 'mechanical-engineering-design': 1 } },
    ],
  },
  {
    id: 'goal',
    question: 'What matters most in your first job?',
    options: [
      { id: 'growth', label: 'Fast growth in a startup / tech company', weights: { 'full-stack-web-development': 1, 'product-management': 2, 'data-science-ai': 1 } },
      { id: 'stability', label: 'Job security and stability', weights: { 'government-public-sector': 3, 'finance-accounting': 1 } },
      { id: 'impact', label: 'Social impact and helping others', weights: { 'human-resources': 1, 'content-technical-writing': 1, 'government-public-sector': 1 } },
      { id: 'freedom', label: 'Remote / freelance flexibility', weights: { 'content-technical-writing': 2, 'ui-ux-design': 1, 'digital-marketing': 2 } },
      { id: 'core', label: 'Working in my core engineering branch', weights: { 'mechanical-engineering-design': 2, 'civil-engineering': 2, 'electronics-embedded-vlsi': 2 } },
    ],
  },
  {
    id: 'tool',
    question: 'Which tool would you most like to master?',
    options: [
      { id: 'code', label: 'A programming language', weights: { 'full-stack-web-development': 2, 'mobile-app-development': 2 } },
      { id: 'excel', label: 'Excel / Power BI', weights: { 'data-analytics': 2, 'finance-accounting': 1, 'business-analysis-consulting': 2 } },
      { id: 'figma', label: 'Figma / design tools', weights: { 'ui-ux-design': 3 } },
      { id: 'cad', label: 'CAD / simulation software', weights: { 'mechanical-engineering-design': 2, 'civil-engineering': 2 } },
      { id: 'cloud', label: 'Cloud platforms & servers', weights: { 'cloud-devops': 3, 'cybersecurity': 1 } },
      { id: 'social', label: 'Social media & ad platforms', weights: { 'digital-marketing': 3 } },
    ],
  },
];

/** Offline counsellor intents (used when no AI provider is available). */
export const COUNSELLOR_RULES = [
  {
    match: ['resume', 'cv', 'ats'],
    answer:
      'A strong fresher resume is one page: contact + links, a 2-line summary tailored to the role, education, 2–3 projects with impact ("built X using Y, improved Z by N%"), skills, certifications and achievements. Use a simple single-column layout so ATS can read it. Build one in Profile → Resume and print it as PDF.',
  },
  {
    match: ['linkedin'],
    answer:
      'LinkedIn checklist: clear photo, headline with your target role ("Aspiring Data Analyst | SQL | Power BI"), an About section with your story and goals, featured projects, skills, and certifications. Connect with alumni and people in your target companies, and post about what you learn once a week.',
  },
  {
    match: ['github', 'portfolio'],
    answer:
      'Pin 3–6 of your best repositories, each with a README explaining the problem, tech stack, screenshots and a live demo link. Commit regularly and keep code clean. Non-tech students can use a personal site, Behance or a Google Drive portfolio instead.',
  },
  {
    match: ['interview', 'hr round', 'tell me about yourself'],
    answer:
      'Prepare a 60-second self-introduction, 5 STAR stories (Situation, Task, Action, Result) about challenges, teamwork and failures, and revise your projects deeply. Research the company. Practise with a friend or mentor and request a mock interview from your mentor in Connect.',
  },
  {
    match: ['internship', 'intern'],
    answer:
      'Start applying from your 2nd/3rd year. Use the Opportunities page (curated by admins and mentors, plus InternSaathi, Unstop and Indeed searches). Track every application in "My tracker", customise your resume per role, and follow up politely after a week.',
  },
  {
    match: ['dsa', 'leetcode', 'coding interview', 'placement'],
    answer:
      'For placements: pick one language, learn core data structures (arrays, strings, hashing, stacks/queues, trees, graphs) and solve 2–3 problems daily. Revise OOP, DBMS, OS and computer networks basics. Take a weekly timed contest to build speed.',
  },
  {
    match: ['gate', 'cat', 'gre', 'higher studies', 'masters', 'mba'],
    answer:
      'Higher studies options: GATE (M.Tech/PSUs), CAT/XAT (MBA), GRE/IELTS (abroad). Decide based on your long-term goal, finances and interest in research vs industry. Ask a mentor who took that path, and keep building skills in parallel.',
  },
  {
    match: ['which career', 'confused', 'career choice', 'what should i do', 'which field', 'choose'],
    answer:
      'Feeling unsure is normal. Take the Career Compass quiz on the Roadmap page — it suggests tracks based on your interests. Then try a 2-week "taster" of the top suggestion before committing, and discuss it with a mentor.',
  },
  {
    match: ['stress', 'anxious', 'anxiety', 'burnout', 'tired', 'overwhelmed', 'pressure', 'sad', 'lonely'],
    answer:
      'It sounds like you are carrying a lot. Try breaking work into small daily goals, keep regular sleep, move your body for 20 minutes, and talk to someone you trust. The Wellness page has a breathing exercise and focus timer. If it feels heavy, Tele-MANAS offers free, confidential support 24×7 at 14416 or 1-800-891-4416.',
  },
  {
    match: ['salary', 'package', 'ctc'],
    answer:
      'Fresher pay varies widely by role, city, company and skills, so compare ranges on job portals for your exact role and location rather than relying on averages. Focus first on skills and projects — they have the biggest impact on offers.',
  },
];

export const CRISIS_PATTERNS = [/suicid/i, /kill myself/i, /end my life/i, /self[- ]?harm/i, /want to die/i, /no reason to live/i];

export const CRISIS_RESPONSE =
  "I'm really sorry you're feeling this way. You don't have to face it alone. Please reach out right now to Tele-MANAS (free, confidential, 24×7): call 14416 or 1-800-891-4416. If you are in immediate danger, call 112. Talking to someone you trust — a friend, family member or your mentor — can also help.";

export const WELLNESS_RESOURCES = {
  helplines: [
    { name: 'Tele-MANAS (Govt. of India)', contact: '14416 or 1-800-891-4416', note: 'Free, confidential mental health support, 24×7, multiple languages' },
    { name: 'Emergency', contact: '112', note: 'National emergency number' },
  ],
  tips: [
    'Sleep 7–8 hours at regular times — memory and focus depend on it.',
    'Use the 50/10 rule: 50 minutes of focused work, 10 minutes away from screens.',
    'Move for at least 20–30 minutes a day; even a brisk walk helps mood.',
    'Drink water regularly — aim for around 8 glasses a day.',
    'Compare yourself with your past self, not with others on social media.',
    'Talk about pressure early — with a friend, mentor, or counsellor.',
  ],
};

/** External opportunity search links built from a student's career tracks. */
export function externalSearchLinks(query, location = 'India') {
  const q = encodeURIComponent(query);
  const l = encodeURIComponent(location);
  return [
    { source: 'unstop', label: 'Competitions & hackathons on Unstop', url: `https://unstop.com/competitions?searchTerm=${q}` },
    { source: 'unstop', label: 'Internships on Unstop', url: `https://unstop.com/internships?searchTerm=${q}` },
    { source: 'indeed', label: 'Jobs on Indeed', url: `https://in.indeed.com/jobs?q=${q}&l=${l}` },
    { source: 'indeed', label: 'Internships on Indeed', url: `https://in.indeed.com/jobs?q=${q}+intern&l=${l}` },
    { source: 'linkedin', label: 'Jobs on LinkedIn', url: `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${l}` },
    { source: 'ncs', label: 'National Career Service (Govt.)', url: 'https://www.ncs.gov.in/' },
  ];
}
