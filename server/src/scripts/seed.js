/**
 * Demo data for local development and testing.
 *   npm run seed         → adds demo data if the demo accounts don't exist yet
 *   npm run seed:reset   → wipes the database first (refused in production)
 * Logins come from SEED_* variables in server/.env.
 */
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { connectDB } from '../config/db.js';
import {
  User, Roadmap, Enrollment, Opportunity, Meeting, Mentorship, MentorNote, Community, CommunityMember,
  Conversation, Message, WellnessLog, Application,
} from '../models/index.js';
import { ROLES, USER_STATUS, LEGAL_VERSIONS } from '../config/constants.js';
import { ensureLibrary } from './bootstrap.js';
import { dayKey, addDays, randomToken } from '../utils/helpers.js';
import { encrypt } from '../services/crypto.service.js';
import { refreshReadiness } from '../services/readiness.service.js';

const reset = process.argv.includes('--reset');
const consents = { termsVersion: LEGAL_VERSIONS.terms, privacyVersion: LEGAL_VERSIONS.privacy, acceptedAt: new Date() };
const pick = (arr, i) => arr[i % arr.length];

async function main() {
  if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD || !env.SEED_STUDENT_PASSWORD || !env.SEED_MENTOR_PASSWORD) {
    throw new Error('Set SEED_ADMIN_*, SEED_MENTOR_* and SEED_STUDENT_* in server/.env first.');
  }
  if (!(await connectDB({ retry: false }))) throw new Error('Could not connect to MongoDB');

  if (reset) {
    if (env.isProd) throw new Error('Refusing to reset a production database.');
    await mongoose.connection.dropDatabase();
    console.log('✔ Database reset');
  }
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).createIndexes()));
  await ensureLibrary();

  if (await User.exists({ email: env.SEED_STUDENT_EMAIL })) {
    console.log('Demo data already present. Use `npm run seed:reset` to start fresh.');
    return;
  }

  const admin = await User.findOne({ role: ROLES.ADMIN });

  // ---- Mentors
  const mentorDefs = [
    { name: 'Ananya Rao', email: env.SEED_MENTOR_EMAIL, designation: 'Senior Software Engineer', company: 'Product startup, Bengaluru', expertise: ['Web Development', 'React', 'Node.js', 'Interviews'], years: 7 },
    { name: 'Rahul Mehta', email: 'mentor.data@careersaathi.test', designation: 'Data Scientist', company: 'Analytics firm, Pune', expertise: ['Data Science', 'Machine Learning', 'SQL'], years: 6 },
    { name: 'Priya Nair', email: 'mentor.hr@careersaathi.test', designation: 'HR Business Partner', company: 'IT services, Chennai', expertise: ['Human Resources', 'Recruitment', 'Communication'], years: 9 },
  ];
  const mentors = [];
  for (const m of mentorDefs) {
    mentors.push(
      await User.create({
        name: m.name,
        email: m.email,
        password: env.SEED_MENTOR_PASSWORD,
        role: ROLES.MENTOR,
        status: USER_STATUS.ACTIVE,
        emailVerified: true,
        headline: `${m.designation} · ${m.company}`,
        bio: `I help students build practical skills in ${m.expertise.slice(0, 2).join(' and ')} and prepare for their first job.`,
        mentorProfile: { designation: m.designation, company: m.company, expertise: m.expertise, experienceYears: m.years, maxMentees: 25, availability: 'Weekday evenings, Saturday mornings', approvedAt: new Date(), approvedBy: admin._id },
        consents,
        unsubscribeToken: randomToken(24),
      }),
    );
  }
  // A pending mentor application for the admin to review
  await User.create({
    name: 'Vikram Singh', email: 'mentor.pending@careersaathi.test', password: env.SEED_MENTOR_PASSWORD, role: ROLES.MENTOR, status: USER_STATUS.PENDING,
    mentorProfile: { designation: 'Mechanical Design Lead', company: 'Automotive OEM, Pune', expertise: ['Mechanical', 'CAD', 'GATE'], experienceYears: 11 },
    consents, unsubscribeToken: randomToken(24),
  });

  // ---- Students
  const colleges = ['Government Engineering College, Ajmer', 'Delhi University — Hansraj College', 'Pune Institute of Technology', 'St. Xavier’s College, Mumbai', 'NIT Trichy', 'Christ University, Bengaluru'];
  const studentDefs = [
    { name: 'Aarav Sharma', email: env.SEED_STUDENT_EMAIL, degree: 'B.Tech', branch: 'Computer Science', tracks: ['full-stack-web-development'], skills: ['HTML', 'CSS', 'JavaScript', 'Git', 'React'], city: 'Jaipur', state: 'Rajasthan', source: 'instagram' },
    { name: 'Diya Patel', email: 'diya@careersaathi.test', degree: 'B.Sc', branch: 'Statistics', tracks: ['data-science-ai', 'data-analytics'], skills: ['Python', 'Excel', 'Statistics'], city: 'Ahmedabad', state: 'Gujarat', source: 'college-drive' },
    { name: 'Kabir Khan', email: 'kabir@careersaathi.test', degree: 'BBA', branch: 'Human Resources', tracks: ['human-resources'], skills: ['Communication', 'Excel'], city: 'Lucknow', state: 'Uttar Pradesh', source: 'linkedin' },
    { name: 'Meera Iyer', email: 'meera@careersaathi.test', degree: 'B.Com', branch: 'Accounting & Finance', tracks: ['finance-accounting'], skills: ['Tally', 'Excel', 'Accounting'], city: 'Chennai', state: 'Tamil Nadu', source: 'direct' },
    { name: 'Rohan Das', email: 'rohan@careersaathi.test', degree: 'B.Tech', branch: 'Mechanical', tracks: ['mechanical-engineering-design'], skills: ['AutoCAD', 'SolidWorks'], city: 'Kolkata', state: 'West Bengal', source: 'college-drive' },
    { name: 'Sara Thomas', email: 'sara@careersaathi.test', degree: 'B.Des', branch: 'Communication Design', tracks: ['ui-ux-design'], skills: ['Figma', 'Typography', 'User Research'], city: 'Kochi', state: 'Kerala', source: 'instagram' },
    { name: 'Arjun Reddy', email: 'arjun@careersaathi.test', degree: 'B.Tech', branch: 'Electronics & Communication', tracks: ['electronics-embedded-vlsi'], skills: ['C', 'Arduino', 'Verilog'], city: 'Hyderabad', state: 'Telangana', source: 'direct' },
    { name: 'Ishita Gupta', email: 'ishita@careersaathi.test', degree: 'BCA', branch: 'Computer Applications', tracks: ['cybersecurity', 'cloud-devops'], skills: ['Linux', 'Networking', 'Python'], city: 'Indore', state: 'Madhya Pradesh', source: 'linkedin' },
  ];
  const students = [];
  for (const [i, s] of studentDefs.entries()) {
    const student = await User.create({
      name: s.name,
      email: s.email,
      password: env.SEED_STUDENT_PASSWORD,
      phone: `+91 98${String(10000000 + i * 1234567).slice(0, 8)}`,
      role: ROLES.STUDENT,
      emailVerified: i % 3 !== 2,
      headline: `${s.degree} ${s.branch} student`,
      education: { level: 'UG', degree: s.degree, branch: s.branch, college: pick(colleges, i), graduationYear: 2026 + (i % 3), currentYear: 1 + (i % 4), cgpa: 7 + (i % 3) * 0.6 },
      address: { city: s.city, state: s.state, country: 'India' },
      careerTracks: s.tracks,
      skills: s.skills,
      links: i === 0 ? { linkedin: 'https://www.linkedin.com/in/example', github: 'https://github.com/example' } : {},
      careerKit: i === 0 ? { resume: true, linkedin: true, professionalEmail: true } : {},
      acquisition: { utmSource: s.source },
      consents: { ...consents, wellnessShareWithMentor: i === 0 },
      unsubscribeToken: randomToken(24),
      createdAt: addDays(new Date(), -(i * 3 + 1)),
      lastActiveAt: addDays(new Date(), -(i % 4)),
    });
    students.push(student);

    // Enrollments with some progress
    const roadmaps = await Roadmap.find({ slug: { $in: s.tracks } }).lean();
    for (const r of roadmaps) {
      const keys = r.phases.flatMap((p) => p.steps.map((st) => st.key));
      const doneCount = Math.floor(keys.length * (0.15 + (i % 4) * 0.15));
      const completed = keys.slice(0, doneCount).map((key, k) => ({ key, at: addDays(new Date(), -(doneCount - k)) }));
      await Enrollment.create({ user: student._id, roadmap: r._id, completed, progress: Math.round((doneCount / keys.length) * 100), lastActivityAt: new Date() });
    }
  }

  // ---- Mentorships & chat
  const [aarav, diya, kabir] = students;
  const pairs = [
    [aarav, mentors[0], 'active'],
    [diya, mentors[1], 'active'],
    [kabir, mentors[2], 'active'],
    [students[7], mentors[0], 'pending'],
  ];
  for (const [student, mentor, status] of pairs) {
    await Mentorship.create({ student: student._id, mentor: mentor._id, status, requestMessage: 'I would love your guidance on building my career.', respondedAt: status === 'active' ? new Date() : undefined });
    if (status === 'active') {
      const key = [String(student._id), String(mentor._id)].sort().join(':');
      const convo = await Conversation.create({ type: 'direct', key, participants: [student._id, mentor._id] });
      const lines = [
        [mentor, `Hi ${student.name.split(' ')[0]}! Happy to mentor you. What are you focusing on this month?`],
        [student, 'Thank you! I am working through my roadmap and want to build a strong project for internships.'],
        [mentor, 'Great plan. Pick one project, ship it end-to-end, and write a clear README. Share the link when ready and I will review it.'],
      ];
      let t = addDays(new Date(), -2).getTime();
      for (const [sender, text] of lines) {
        t += 3600_000;
        await Message.create({ conversation: convo._id, sender: sender._id, text, readBy: [sender._id], createdAt: new Date(t) });
      }
      await Conversation.updateOne({ _id: convo._id }, { lastMessageAt: new Date(t), lastMessage: lines.at(-1)[1].slice(0, 140) });
      await MentorNote.create({ mentor: mentor._id, student: student._id, type: 'goal', text: 'Complete one portfolio-ready project and update your resume by the end of this month.', visibleToStudent: true });
    }
  }

  // ---- Communities: add students to relevant ones and seed a few posts
  const communities = await Community.find().lean();
  for (const c of communities) {
    const members = students.filter((s) => !c.track || s.careerTracks.includes(c.track) || c.name === 'Placement Prep');
    for (const m of members) await CommunityMember.updateOne({ community: c._id, user: m._id }, { $setOnInsert: { role: 'member' } }, { upsert: true });
    await Community.updateOne({ _id: c._id }, { memberCount: members.length });
    if (members.length && c.conversation) {
      const msgs = [`Hi everyone! Excited to learn together in ${c.name}.`, 'Sharing one tip: consistency beats intensity — small progress daily adds up.'];
      for (const [k, text] of msgs.entries()) {
        await Message.create({ conversation: c.conversation, sender: members[k % members.length]._id, text, readBy: [members[k % members.length]._id], createdAt: addDays(new Date(), -1 + k * 0.1) });
      }
      await Conversation.updateOne({ _id: c.conversation }, { lastMessageAt: new Date(), lastMessage: msgs.at(-1) });
    }
  }

  // ---- Opportunities (demo listings, clearly labelled)
  const opps = [
    { title: 'Frontend Developer Intern (React)', organization: 'Demo Tech Pvt. Ltd.', type: 'internship', source: 'internsaathi', tracks: ['full-stack-web-development'], mode: 'remote', compensation: '₹10,000/month', deadline: 20 },
    { title: 'Data Analyst — Fresher', organization: 'Demo Analytics LLP', type: 'job', source: 'naukrisaathi', tracks: ['data-analytics', 'data-science-ai'], mode: 'hybrid', location: 'Pune', compensation: 'As per industry', deadline: 25 },
    { title: 'National Student Hackathon 2026', organization: 'Demo Innovation Council', type: 'hackathon', source: 'unstop', tracks: [], mode: 'remote', compensation: 'Prizes worth ₹1,00,000', deadline: 12 },
    { title: 'HR Operations Intern', organization: 'Demo People Solutions', type: 'internship', source: 'internsaathi', tracks: ['human-resources'], mode: 'onsite', location: 'Chennai', compensation: '₹8,000/month', deadline: 18 },
    { title: 'Certified Digital Skills Programme', organization: 'KaushalSaathi (demo listing)', type: 'workshop', source: 'kaushalsaathi', tracks: [], mode: 'remote', compensation: 'Free', deadline: 30 },
    { title: 'Junior Accountant', organization: 'Demo Finance Associates', type: 'job', source: 'indeed', tracks: ['finance-accounting'], mode: 'onsite', location: 'Mumbai', compensation: '₹2.4–3 LPA', deadline: 15 },
    { title: 'UI/UX Design Challenge', organization: 'Demo Design Guild', type: 'competition', source: 'unstop', tracks: ['ui-ux-design'], mode: 'remote', compensation: 'Internship offers for winners', deadline: 10 },
    { title: 'Merit Scholarship for Women in STEM', organization: 'Demo Education Foundation', type: 'scholarship', source: 'other', tracks: [], mode: 'remote', compensation: '₹50,000', deadline: 40 },
  ];
  const created = [];
  for (const [i, o] of opps.entries()) {
    created.push(
      await Opportunity.create({
        ...o,
        url: '',
        description: `This is a demo listing created by the seed script to show how ${o.type}s appear on CareerSaathi. Admins and mentors can post real opportunities from their dashboards.`,
        eligibility: 'Students currently pursuing a graduation degree.',
        deadline: addDays(new Date(), o.deadline),
        postedBy: i % 3 === 0 ? mentors[0]._id : admin._id,
        postedByRole: i % 3 === 0 ? 'mentor' : 'admin',
      }),
    );
  }
  await Application.create({ user: aarav._id, opportunity: created[0]._id, status: 'applied', notes: 'Applied with updated resume.' });
  await Application.create({ user: aarav._id, opportunity: created[2]._id, status: 'saved' });

  // ---- Sessions
  const at = (days, hour) => {
    const d = addDays(new Date(), days);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  await Meeting.create({
    title: 'Bridging the Industry–Academia Gap: What Recruiters Expect', description: 'Open seminar on skills, projects and how to stand out as a fresher.', type: 'seminar',
    host: admin._id, hostRole: 'admin', startAt: at(3, 18), durationMinutes: 60, audience: { type: 'students' }, roomName: `CareerSaathi-${crypto.randomBytes(9).toString('base64url')}`, attendees: [aarav._id, diya._id],
  });
  await Meeting.create({
    title: 'Mock Interview Clinic — Web Developers', description: 'Live mock interviews with feedback for my mentees.', type: 'mock-interview',
    host: mentors[0]._id, hostRole: 'mentor', startAt: at(5, 19), durationMinutes: 90, audience: { type: 'mentees' }, roomName: `CareerSaathi-${crypto.randomBytes(9).toString('base64url')}`,
  });
  await Meeting.create({
    title: 'Managing Exam & Placement Stress', description: 'A practical wellbeing session for all students.', type: 'webinar',
    host: admin._id, hostRole: 'admin', startAt: at(7, 17), durationMinutes: 45, audience: { type: 'all' }, roomName: `CareerSaathi-${crypto.randomBytes(9).toString('base64url')}`,
  });

  // ---- Wellness history for the demo student
  for (let d = 9; d >= 1; d -= 1) {
    await WellnessLog.create({
      user: aarav._id, day: dayKey(addDays(new Date(), -d)), mood: 3 + (d % 3 === 0 ? 1 : 0) - (d === 5 ? 1 : 0), stress: 2 + (d % 2), sleepHours: 6 + (d % 3),
      exerciseMinutes: (d % 4) * 15, waterGlasses: 5 + (d % 4), journal: d === 2 ? encrypt('Finished the React module. Feeling more confident.') : '',
    });
  }

  for (const s of students) await refreshReadiness(s._id);
  console.log(`✔ Seeded ${mentors.length + 1} mentors, ${students.length} students, ${opps.length} opportunities, 3 sessions.`);
  console.log('  Demo logins are the SEED_* values in server/.env (all demo students share SEED_STUDENT_PASSWORD).');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
