import { Mentorship } from '../../models/index.js';
import { ROLES } from '../../config/constants.js';

/** Mongo filter for meetings a given user is allowed to see. */
export async function meetingVisibilityFilter(user) {
  if (user.role === ROLES.ADMIN) return {};
  const or = [{ 'audience.type': 'all' }, { 'audience.users': user._id }, { host: user._id }];
  if (user.role === ROLES.STUDENT) {
    or.push({ 'audience.type': 'students' });
    if (user.careerTracks?.length) or.push({ 'audience.type': 'tracks', 'audience.tracks': { $in: user.careerTracks } });
    const mentors = await Mentorship.find({ student: user._id, status: 'active' }).select('mentor').lean();
    if (mentors.length) or.push({ 'audience.type': 'mentees', host: { $in: mentors.map((m) => m.mentor) } });
  }
  if (user.role === ROLES.MENTOR) or.push({ 'audience.type': 'mentors' });
  return { $or: or };
}

export const joinWindow = (meeting) => {
  const start = new Date(meeting.startAt).getTime();
  const end = start + meeting.durationMinutes * 60_000;
  const now = Date.now();
  return { canJoin: now >= start - 15 * 60_000 && now <= end + 30 * 60_000, started: now >= start, ended: now > end };
};
