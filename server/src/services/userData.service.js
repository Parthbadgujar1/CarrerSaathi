/**
 * Data-subject rights: export everything we hold about a user, and erase it.
 * (Aligned with India's DPDP Act 2023 principles: access, correction, erasure.)
 */
import mongoose from 'mongoose';
import {
  User, Session, Token, Enrollment, Roadmap, Application, WellnessLog, Notification, Mentorship, MentorNote,
  CommunityMember, Community, Conversation, Message, AiLog, Opportunity, Meeting, DeletionRequest,
} from '../models/index.js';
import { decrypt } from './crypto.service.js';
import { logger } from '../config/logger.js';

export async function exportUserData(userId) {
  const [user, enrollments, applications, wellness, notes, memberships, messages, mentorships] = await Promise.all([
    User.findById(userId).lean(),
    Enrollment.find({ user: userId }).populate('roadmap', 'title slug').lean(),
    Application.find({ user: userId }).populate('opportunity', 'title organization').lean(),
    WellnessLog.find({ user: userId }).sort({ day: -1 }).lean(),
    MentorNote.find({ student: userId, visibleToStudent: true }).lean(),
    CommunityMember.find({ user: userId }).populate('community', 'name').lean(),
    Message.find({ sender: userId, deletedAt: null }).select('text createdAt conversation').lean(),
    Mentorship.find({ $or: [{ student: userId }, { mentor: userId }] }).populate('student mentor', 'name email').lean(),
  ]);
  if (!user) return null;
  delete user.password;
  delete user.unsubscribeToken;
  return {
    exportedAt: new Date().toISOString(),
    profile: user,
    roadmaps: enrollments.map((e) => ({ roadmap: e.roadmap?.title, progress: e.progress, completedSteps: e.completed, status: e.status })),
    applications: applications.map((a) => ({ opportunity: a.opportunity?.title, organization: a.opportunity?.organization, status: a.status, notes: a.notes })),
    wellnessLogs: wellness.map((w) => ({ ...w, journal: decrypt(w.journal) })),
    mentorNotes: notes,
    mentorships,
    communities: memberships.map((m) => m.community?.name).filter(Boolean),
    messagesSent: messages,
  };
}

/** Permanently erases a user and their personal data. */
export async function purgeUser(userId) {
  const id = new mongoose.Types.ObjectId(String(userId));
  const user = await User.findById(id).lean();
  if (!user) return false;

  const memberships = await CommunityMember.find({ user: id }).select('community').lean();
  const directConvos = await Conversation.find({ type: 'direct', participants: id }).select('_id').lean();
  const directIds = directConvos.map((c) => c._id);

  await Promise.all([
    Session.deleteMany({ user: id }),
    Token.deleteMany({ user: id }),
    Enrollment.deleteMany({ user: id }),
    Roadmap.deleteMany({ owner: id }),
    Application.deleteMany({ user: id }),
    WellnessLog.deleteMany({ user: id }),
    Notification.deleteMany({ user: id }),
    Mentorship.deleteMany({ $or: [{ student: id }, { mentor: id }] }),
    MentorNote.deleteMany({ $or: [{ student: id }, { mentor: id }] }),
    CommunityMember.deleteMany({ user: id }),
    Message.deleteMany({ $or: [{ sender: id }, { conversation: { $in: directIds } }] }),
    Conversation.deleteMany({ _id: { $in: directIds } }),
    AiLog.updateMany({ user: id }, { $unset: { user: 1 } }),
    Opportunity.deleteMany({ postedBy: id }),
    Meeting.deleteMany({ host: id }),
    Meeting.updateMany({}, { $pull: { attendees: id, 'audience.users': id } }),
    DeletionRequest.updateMany({ user: id, status: 'pending' }, { status: 'completed', processedAt: new Date() }),
  ]);
  for (const m of memberships) {
    await Community.updateOne({ _id: m.community, memberCount: { $gt: 0 } }, { $inc: { memberCount: -1 } });
  }
  await User.deleteOne({ _id: id });
  logger.info('User data purged', { userId: String(id) });
  return { email: user.email, name: user.name };
}
