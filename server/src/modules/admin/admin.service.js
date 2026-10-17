import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import {
  User, Opportunity, Meeting, Community, Roadmap, Enrollment, Application, WellnessLog, Mentorship,
} from '../../models/index.js';
import { ROLES, USER_STATUS } from '../../config/constants.js';
import { escapeRegex, addDays, dayKey } from '../../utils/helpers.js';
import { STUDENT_EXPORT_FIELDS } from './admin.validation.js';

export function buildStudentFilter(q = {}) {
  const filter = { role: ROLES.STUDENT };
  if (q.status) filter.status = q.status;
  if (q.college) filter['education.college'] = new RegExp(escapeRegex(q.college), 'i');
  if (q.degree) filter['education.degree'] = new RegExp(escapeRegex(q.degree), 'i');
  if (q.track) filter.careerTracks = q.track;
  if (q.graduationYear) filter['education.graduationYear'] = q.graduationYear;
  if (q.verified) filter.emailVerified = q.verified === 'true';
  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) filter.createdAt.$gte = q.from;
    if (q.to) filter.createdAt.$lte = addDays(q.to, 1);
  }
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { 'education.college': rx }];
  }
  return filter;
}

export const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { name: 1 },
  readiness: { readinessScore: -1 },
  active: { lastActiveAt: -1 },
};

const fmtDate = (d) => (d ? new Date(d) : null);

function rowFor(u) {
  return {
    name: u.name,
    email: u.email,
    phone: u.phone,
    emailVerified: u.emailVerified ? 'Yes' : 'No',
    status: u.status,
    degreeLevel: u.education?.level,
    degree: u.education?.degree,
    branch: u.education?.branch,
    college: u.education?.college,
    university: u.education?.university,
    currentYear: u.education?.currentYear,
    graduationYear: u.education?.graduationYear,
    cgpa: u.education?.cgpa,
    addressLine: u.address?.line1,
    city: u.address?.city,
    state: u.address?.state,
    pincode: u.address?.pincode,
    careerTracks: (u.careerTracks || []).join(', '),
    skills: (u.skills || []).join(', '),
    readinessScore: u.readinessScore,
    linkedin: u.links?.linkedin,
    github: u.links?.github,
    utmSource: u.acquisition?.utmSource || 'direct',
    registeredAt: fmtDate(u.createdAt),
    lastActiveAt: fmtDate(u.lastActiveAt),
  };
}

/** Streams an .xlsx straight to the response — constant memory even for large exports. */
export async function streamStudentsExcel(res, { filters, fields, ids }) {
  const filter = ids.length ? { role: ROLES.STUDENT, _id: { $in: ids } } : buildStudentFilter(filters);
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
  workbook.creator = 'CareerSaathi';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Students', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = fields.map((key) => ({
    header: STUDENT_EXPORT_FIELDS[key],
    key,
    width: ['email', 'college', 'addressLine', 'careerTracks', 'skills', 'linkedin', 'github'].includes(key) ? 32 : 16,
    style: ['registeredAt', 'lastActiveAt'].includes(key) ? { numFmt: 'dd-mmm-yyyy hh:mm' } : {},
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).commit();

  let count = 0;
  const cursor = User.find(filter).sort(SORTS[filters.sort] || SORTS.newest).lean().cursor({ batchSize: 500 });
  for await (const u of cursor) {
    const row = rowFor(u);
    sheet.addRow(Object.fromEntries(fields.map((f) => [f, row[f] ?? ''])));
    // Each row is committed so memory stays flat.
    sheet.lastRow.commit();
    count += 1;
  }
  sheet.commit();
  await workbook.commit();
  return count;
}

export async function dashboardStats() {
  const now = new Date();
  const d7 = addDays(now, -7);
  const d30 = addDays(now, -29);
  d30.setHours(0, 0, 0, 0);
  const studentMatch = { role: ROLES.STUDENT };

  const [
    students, verified, newWeek, active7, mentors, pendingMentors,
    signups, byTrack, byCollege, byDegree, bySource, readiness,
    oppActive, meetingsUpcoming, communities, roadmaps, enrollStats, applications, checkins7, mentorships,
  ] = await Promise.all([
    User.countDocuments({ ...studentMatch, status: { $ne: USER_STATUS.DELETION_PENDING } }),
    User.countDocuments({ ...studentMatch, emailVerified: true }),
    User.countDocuments({ ...studentMatch, createdAt: { $gte: d7 } }),
    User.countDocuments({ ...studentMatch, lastActiveAt: { $gte: d7 } }),
    User.countDocuments({ role: ROLES.MENTOR, status: USER_STATUS.ACTIVE }),
    User.countDocuments({ role: ROLES.MENTOR, status: USER_STATUS.PENDING }),
    User.aggregate([
      { $match: { ...studentMatch, createdAt: { $gte: d30 } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    User.aggregate([{ $match: studentMatch }, { $unwind: '$careerTracks' }, { $group: { _id: '$careerTracks', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    User.aggregate([{ $match: { ...studentMatch, 'education.college': { $nin: ['', null] } } }, { $group: { _id: '$education.college', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    User.aggregate([{ $match: { ...studentMatch, 'education.degree': { $nin: ['', null] } } }, { $group: { _id: '$education.degree', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    User.aggregate([{ $match: studentMatch }, { $group: { _id: { $ifNull: ['$acquisition.utmSource', 'direct'] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 6 }]),
    User.aggregate([
      { $match: studentMatch },
      {
        $group: {
          _id: null,
          avg: { $avg: '$readinessScore' },
          low: { $sum: { $cond: [{ $lt: ['$readinessScore', 40] }, 1, 0] } },
          mid: { $sum: { $cond: [{ $and: [{ $gte: ['$readinessScore', 40] }, { $lt: ['$readinessScore', 70] }] }, 1, 0] } },
          high: { $sum: { $cond: [{ $gte: ['$readinessScore', 70] }, 1, 0] } },
        },
      },
    ]),
    Opportunity.countDocuments({ status: 'active', $or: [{ deadline: null }, { deadline: { $gte: now } }] }),
    Meeting.countDocuments({ status: 'scheduled', startAt: { $gte: now } }),
    Community.countDocuments({ status: 'active' }),
    Roadmap.countDocuments({ isPublished: true, owner: null }),
    Enrollment.aggregate([{ $group: { _id: null, total: { $sum: 1 }, avgProgress: { $avg: '$progress' } } }]),
    Application.countDocuments({ status: { $in: ['applied', 'interview', 'offer'] } }),
    WellnessLog.countDocuments({ day: { $gte: dayKey(d7) } }),
    Mentorship.countDocuments({ status: 'active' }),
  ]);

  // Fill missing days so the chart has a continuous 30-day axis.
  const signupMap = new Map(signups.map((s) => [s._id, s.count]));
  const series = [];
  for (let i = 0; i < 30; i += 1) {
    const key = dayKey(addDays(d30, i));
    series.push({ day: key, count: signupMap.get(key) || 0 });
  }

  const trackTitles = new Map((await Roadmap.find({ slug: { $in: byTrack.map((t) => t._id) } }).select('slug title').lean()).map((r) => [r.slug, r.title]));
  const r = readiness[0] || {};
  return {
    totals: { students, verified, newThisWeek: newWeek, activeThisWeek: active7, mentors, pendingMentors, mentorships },
    content: { opportunities: oppActive, upcomingSessions: meetingsUpcoming, communities, roadmaps },
    engagement: {
      enrollments: enrollStats[0]?.total || 0,
      avgRoadmapProgress: Math.round(enrollStats[0]?.avgProgress || 0),
      applications,
      wellnessCheckins7d: checkins7,
    },
    readiness: { average: Math.round(r.avg || 0), low: r.low || 0, mid: r.mid || 0, high: r.high || 0 },
    signups: series,
    byTrack: byTrack.map((t) => ({ label: trackTitles.get(t._id) || t._id, count: t.count })),
    byCollege: byCollege.map((c) => ({ label: c._id, count: c.count })),
    byDegree: byDegree.map((c) => ({ label: c._id, count: c.count })),
    bySource: bySource.map((c) => ({ label: c._id, count: c.count })),
  };
}

export const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));
