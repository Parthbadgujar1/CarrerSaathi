import mongoose from 'mongoose';
import { Conversation, Message, CommunityMember, Mentorship, User, Community } from '../../models/index.js';
import { ROLES } from '../../config/constants.js';
import { ApiError } from '../../utils/ApiError.js';
import { emitToRoom, emitToUser } from '../../sockets/io.js';
import { notify } from '../../services/notification.service.js';

const isStaff = (user) => user.role === ROLES.ADMIN || user.role === ROLES.MENTOR;

/** Loads a conversation and checks the user can read (and optionally write) it. */
export async function assertAccess(user, conversationId, { write = false } = {}) {
  if (!mongoose.isValidObjectId(conversationId)) throw ApiError.notFound('Conversation not found.');
  const convo = await Conversation.findById(conversationId).lean();
  if (!convo) throw ApiError.notFound('Conversation not found.');

  if (convo.type === 'direct') {
    // Private chats are visible only to their participants (not even admins).
    if (!convo.participants.some((p) => String(p) === String(user._id))) throw ApiError.forbidden('You are not part of this conversation.');
    return convo;
  }

  const community = await Community.findById(convo.community).select('status name').lean();
  if (!community) throw ApiError.notFound('Community not found.');
  const member = await CommunityMember.exists({ community: convo.community, user: user._id });
  if (!member && !isStaff(user)) throw ApiError.forbidden('Join this community to see the conversation.');
  if (write && community.status !== 'active') throw ApiError.forbidden('This community is archived.');
  if (write && !member && user.role !== ROLES.ADMIN && user.role !== ROLES.MENTOR) throw ApiError.forbidden('Join this community to post.');
  return { ...convo, communityName: community.name };
}

/** Two users may DM if they have an active mentorship, or if one of them is an admin. */
export async function canDirectMessage(a, b) {
  if (a.role === ROLES.ADMIN || b.role === ROLES.ADMIN) return true;
  const pair = [a, b].map((u) => u._id);
  return Boolean(
    await Mentorship.exists({
      status: 'active',
      $or: [
        { student: pair[0], mentor: pair[1] },
        { student: pair[1], mentor: pair[0] },
      ],
    }),
  );
}

export async function getOrCreateDirect(userA, userBId) {
  const userB = await User.findById(userBId).select('name role status').lean();
  if (!userB || userB.status !== 'active') throw ApiError.notFound('User not found.');
  if (String(userB._id) === String(userA._id)) throw ApiError.badRequest('You cannot message yourself.');
  if (!(await canDirectMessage(userA, userB))) {
    throw ApiError.forbidden('You can message a mentor once they accept your mentorship request.');
  }
  const key = [String(userA._id), String(userB._id)].sort().join(':');
  return Conversation.findOneAndUpdate(
    { key },
    { $setOnInsert: { type: 'direct', key, participants: [userA._id, userB._id] } },
    { upsert: true, new: true },
  ).lean();
}

export async function sendMessage(user, conversationId, text) {
  const clean = String(text || '').trim();
  if (!clean) throw ApiError.badRequest('Message cannot be empty.');
  if (clean.length > 2000) throw ApiError.badRequest('Message is too long (max 2000 characters).');
  const convo = await assertAccess(user, conversationId, { write: true });

  const msg = await Message.create({ conversation: convo._id, sender: user._id, text: clean, readBy: [user._id] });
  await Conversation.updateOne({ _id: convo._id }, { lastMessageAt: msg.createdAt, lastMessage: clean.slice(0, 140) });

  const payload = {
    _id: msg._id,
    conversation: String(convo._id),
    text: msg.text,
    createdAt: msg.createdAt,
    sender: { _id: user._id, name: user.name, role: user.role },
  };
  if (convo.type === 'direct') {
    for (const p of convo.participants) emitToUser(p, 'chat:message', payload);
    const others = convo.participants.filter((p) => String(p) !== String(user._id));
    // "/messages" is resolved client-side to the right inbox for the recipient's role.
    notify(others, { type: 'message', title: `New message from ${user.name}`, body: clean.slice(0, 120), link: '/messages' });
  } else {
    emitToRoom(`conv:${convo._id}`, 'chat:message', payload);
  }
  return payload;
}

export async function listConversations(user) {
  const memberships = await CommunityMember.find({ user: user._id }).select('community').lean();
  const communities = await Community.find({ _id: { $in: memberships.map((m) => m.community) }, status: 'active' }).select('name conversation track').lean();

  const [direct, communityConvos] = await Promise.all([
    Conversation.find({ type: 'direct', participants: user._id }).sort({ lastMessageAt: -1 }).populate('participants', 'name role mentorProfile.designation lastActiveAt').lean(),
    Conversation.find({ _id: { $in: communities.map((c) => c.conversation).filter(Boolean) } }).lean(),
  ]);

  const allIds = [...direct, ...communityConvos].map((c) => c._id);
  const unread = await Message.aggregate([
    { $match: { conversation: { $in: allIds }, readBy: { $ne: user._id }, deletedAt: null } },
    { $group: { _id: '$conversation', count: { $sum: 1 } } },
  ]);
  const unreadBy = new Map(unread.map((u) => [String(u._id), u.count]));
  const communityByConvo = new Map(communities.map((c) => [String(c.conversation), c]));

  const items = [
    ...direct.map((c) => {
      const other = c.participants.find((p) => String(p._id) !== String(user._id));
      return {
        _id: c._id,
        type: 'direct',
        title: other?.name || 'Deleted user',
        subtitle: other?.role === ROLES.MENTOR ? other.mentorProfile?.designation || 'Mentor' : other?.role,
        otherUserId: other?._id,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        unread: unreadBy.get(String(c._id)) || 0,
      };
    }),
    ...communityConvos.map((c) => {
      const community = communityByConvo.get(String(c._id));
      return {
        _id: c._id,
        type: 'community',
        title: community?.name || 'Community',
        subtitle: 'Community',
        communityId: community?._id,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt,
        unread: unreadBy.get(String(c._id)) || 0,
      };
    }),
  ];
  return items.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
}

export async function listMessages(user, conversationId, { before, limit = 40 }) {
  const convo = await assertAccess(user, conversationId);
  const filter = { conversation: convo._id };
  if (before) filter.createdAt = { $lt: new Date(before) };
  const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(Math.min(limit, 100)).populate('sender', 'name role').lean();
  return {
    conversation: { _id: convo._id, type: convo.type, title: convo.communityName },
    messages: messages.reverse().map((m) => ({
      _id: m._id,
      conversation: String(m.conversation),
      text: m.deletedAt ? '' : m.text,
      deleted: Boolean(m.deletedAt),
      createdAt: m.createdAt,
      sender: m.sender || { name: 'Deleted user' },
    })),
    hasMore: messages.length === limit,
  };
}

export async function markRead(user, conversationId) {
  const convo = await assertAccess(user, conversationId);
  await Message.updateMany({ conversation: convo._id, readBy: { $ne: user._id } }, { $addToSet: { readBy: user._id } });
}

export async function deleteMessage(user, messageId) {
  const msg = await Message.findById(messageId);
  if (!msg || msg.deletedAt) throw ApiError.notFound('Message not found.');
  const convo = await Conversation.findById(msg.conversation).lean();
  const own = String(msg.sender) === String(user._id);
  const moderator = convo?.type === 'community' && isStaff(user);
  if (!own && !moderator) throw ApiError.forbidden('You can only delete your own messages.');
  msg.deletedAt = new Date();
  msg.deletedBy = user._id;
  await msg.save();
  const payload = { _id: msg._id, conversation: String(msg.conversation) };
  if (convo.type === 'direct') for (const p of convo.participants) emitToUser(p, 'chat:deleted', payload);
  else emitToRoom(`conv:${convo._id}`, 'chat:deleted', payload);
}
