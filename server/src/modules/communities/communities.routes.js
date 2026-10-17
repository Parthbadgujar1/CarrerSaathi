import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { Community, CommunityMember, Conversation, Message } from '../../models/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { escapeRegex, getPagination, paginated, slugify } from '../../utils/helpers.js';
import { objectId, text, pagination } from '../../utils/schemas.js';
import { MAX_COMMUNITIES_PER_STUDENT, ROLES } from '../../config/constants.js';
import { audit } from '../../services/audit.service.js';

const router = Router();
router.use(authenticate);

const idParam = z.object({ id: objectId });
const isStaff = (u) => u.role === ROLES.ADMIN || u.role === ROLES.MENTOR;

router.get(
  '/',
  validate({ query: z.object({ ...pagination, q: text(80).optional(), track: text(80).optional(), joined: z.enum(['true', 'false']).optional(), status: z.enum(['active', 'archived']).optional() }) }),
  async (req, res) => {
    const { page, limit, skip } = getPagination(req.query, { defaultLimit: 24 });
    const filter = { status: req.user.role === ROLES.ADMIN && req.query.status ? req.query.status : 'active' };
    if (req.query.track) filter.track = req.query.track;
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(req.query.q), 'i');
      filter.$or = [{ name: rx }, { description: rx }, { tags: rx }];
    }
    const memberships = await CommunityMember.find({ user: req.user._id }).select('community role').lean();
    const joinedIds = new Map(memberships.map((m) => [String(m.community), m.role]));
    if (req.query.joined === 'true') filter._id = { $in: memberships.map((m) => m.community) };
    const [items, total] = await Promise.all([
      Community.find(filter).sort({ isOfficial: -1, memberCount: -1 }).skip(skip).limit(limit).lean(),
      Community.countDocuments(filter),
    ]);
    res.json({
      success: true,
      data: paginated(items.map((c) => ({ ...c, joined: joinedIds.has(String(c._id)), myRole: joinedIds.get(String(c._id)) || null })), total, { page, limit }),
    });
  },
);

const createSchema = z.object({
  name: text(80, 3),
  description: text(500).default(''),
  track: text(80).default(''),
  tags: z.array(text(40)).max(8).default([]),
});

router.post('/', validate({ body: createSchema }), async (req, res) => {
  if (!isStaff(req.user)) {
    const created = await Community.countDocuments({ createdBy: req.user._id, status: 'active' });
    if (created >= MAX_COMMUNITIES_PER_STUDENT) throw ApiError.badRequest(`You can create up to ${MAX_COMMUNITIES_PER_STUDENT} communities.`);
  }
  const exists = await Community.exists({ name: new RegExp(`^${escapeRegex(req.body.name)}$`, 'i'), status: 'active' });
  if (exists) throw ApiError.conflict('A community with this name already exists — join it instead!');

  const community = await Community.create({
    ...req.body,
    slug: `${slugify(req.body.name)}-${crypto.randomBytes(2).toString('hex')}`,
    isOfficial: isStaff(req.user),
    createdBy: req.user._id,
    memberCount: 1,
  });
  const convo = await Conversation.create({ type: 'community', community: community._id, lastMessageAt: new Date() });
  community.conversation = convo._id;
  await community.save();
  await CommunityMember.create({ community: community._id, user: req.user._id, role: 'moderator' });
  res.status(201).json({ success: true, data: community, message: 'Community created.' });
});

router.get('/:id', validate({ params: idParam }), async (req, res) => {
  const community = await Community.findById(req.params.id).populate('createdBy', 'name role').lean();
  if (!community || (community.status !== 'active' && req.user.role !== ROLES.ADMIN)) throw ApiError.notFound('Community not found.');
  const [membership, members] = await Promise.all([
    CommunityMember.findOne({ community: community._id, user: req.user._id }).lean(),
    CommunityMember.find({ community: community._id }).sort({ role: -1, createdAt: 1 }).limit(30).populate('user', 'name role').lean(),
  ]);
  res.json({
    success: true,
    data: { ...community, joined: Boolean(membership), myRole: membership?.role || null, members: members.filter((m) => m.user).map((m) => ({ ...m.user, memberRole: m.role })) },
  });
});

router.post('/:id/join', validate({ params: idParam }), async (req, res) => {
  const community = await Community.findOne({ _id: req.params.id, status: 'active' });
  if (!community) throw ApiError.notFound('Community not found.');
  const result = await CommunityMember.updateOne(
    { community: community._id, user: req.user._id },
    { $setOnInsert: { community: community._id, user: req.user._id, role: 'member' } },
    { upsert: true },
  );
  if (result.upsertedCount) await Community.updateOne({ _id: community._id }, { $inc: { memberCount: 1 } });
  res.json({ success: true, data: { conversation: community.conversation }, message: `Welcome to ${community.name}!` });
});

router.post('/:id/leave', validate({ params: idParam }), async (req, res) => {
  const removed = await CommunityMember.findOneAndDelete({ community: req.params.id, user: req.user._id });
  if (removed) await Community.updateOne({ _id: req.params.id, memberCount: { $gt: 0 } }, { $inc: { memberCount: -1 } });
  res.json({ success: true, message: 'You left the community.' });
});

router.patch(
  '/:id',
  validate({ params: idParam, body: z.object({ name: text(80, 3).optional(), description: text(500).optional(), track: text(80).optional(), tags: z.array(text(40)).max(8).optional(), status: z.enum(['active', 'archived']).optional() }) }),
  async (req, res) => {
    const community = await Community.findById(req.params.id);
    if (!community) throw ApiError.notFound('Community not found.');
    const membership = await CommunityMember.findOne({ community: community._id, user: req.user._id, role: 'moderator' }).lean();
    if (req.user.role !== ROLES.ADMIN && !membership) throw ApiError.forbidden('Only moderators or admins can edit this community.');
    Object.assign(community, req.body);
    await community.save();
    audit(req, 'community.update', { targetType: 'community', targetId: community._id, meta: req.body });
    res.json({ success: true, data: community, message: 'Community updated.' });
  },
);

/** Admin: permanently delete a community with its members and chat history. */
router.delete('/:id', validate({ params: idParam }), async (req, res) => {
  if (req.user.role !== ROLES.ADMIN) throw ApiError.forbidden('Only admins can delete communities.');
  const community = await Community.findById(req.params.id);
  if (!community) throw ApiError.notFound('Community not found.');
  await Promise.all([
    CommunityMember.deleteMany({ community: community._id }),
    Message.deleteMany({ conversation: community.conversation }),
    Conversation.deleteOne({ _id: community.conversation }),
    community.deleteOne(),
  ]);
  audit(req, 'community.delete', { targetType: 'community', targetId: community._id, meta: { name: community.name } });
  res.json({ success: true, message: 'Community deleted.' });
});

/** Admin or moderator: remove a member (cannot remove yourself — use Leave). */
router.delete('/:id/members/:userId', validate({ params: z.object({ id: objectId, userId: objectId }) }), async (req, res) => {
  const mod = await CommunityMember.exists({ community: req.params.id, user: req.user._id, role: 'moderator' });
  if (req.user.role !== ROLES.ADMIN && !mod) throw ApiError.forbidden('Only moderators or admins can remove members.');
  const removed = await CommunityMember.findOneAndDelete({ community: req.params.id, user: req.params.userId });
  if (!removed) throw ApiError.notFound('Member not found.');
  await Community.updateOne({ _id: req.params.id, memberCount: { $gt: 0 } }, { $inc: { memberCount: -1 } });
  audit(req, 'community.member.remove', { targetType: 'community', targetId: req.params.id, meta: { user: req.params.userId } });
  res.json({ success: true, message: 'Member removed.' });
});

export default router;
