import mongoose from 'mongoose';

const { Schema } = mongoose;

/** Mentor <-> student relationship. Chat is allowed only while `active`. */
const mentorshipSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    mentor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'active', 'declined', 'ended'], default: 'pending' },
    requestMessage: { type: String, maxlength: 500, default: '' },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    respondedAt: Date,
  },
  { timestamps: true },
);
mentorshipSchema.index({ student: 1, mentor: 1 }, { unique: true });
mentorshipSchema.index({ mentor: 1, status: 1 });
mentorshipSchema.index({ student: 1, status: 1 });

/** Mentor notes, goals and feedback on a student. */
const mentorNoteSchema = new Schema(
  {
    mentor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['note', 'goal', 'feedback'], default: 'note' },
    text: { type: String, required: true, maxlength: 2000 },
    visibleToStudent: { type: Boolean, default: true },
    done: { type: Boolean, default: false },
  },
  { timestamps: true },
);
mentorNoteSchema.index({ student: 1, createdAt: -1 });
mentorNoteSchema.index({ mentor: 1, student: 1 });

const communitySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    track: { type: String, maxlength: 80, default: '' },
    tags: [{ type: String, maxlength: 40 }],
    isOfficial: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    memberCount: { type: Number, default: 0 },
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation' },
  },
  { timestamps: true },
);
communitySchema.index({ status: 1, memberCount: -1 });
communitySchema.index({ track: 1 });
communitySchema.index({ name: 'text', description: 'text', tags: 'text' });

const communityMemberSchema = new Schema(
  {
    community: { type: Schema.Types.ObjectId, ref: 'Community', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['member', 'moderator'], default: 'member' },
  },
  { timestamps: true },
);
communityMemberSchema.index({ community: 1, user: 1 }, { unique: true });
communityMemberSchema.index({ user: 1 });

const conversationSchema = new Schema(
  {
    type: { type: String, enum: ['direct', 'community'], required: true },
    key: { type: String, unique: true, sparse: true }, // sorted participant ids for direct chats
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    community: { type: Schema.Types.ObjectId, ref: 'Community' },
    lastMessageAt: Date,
    lastMessage: { type: String, maxlength: 140 },
  },
  { timestamps: true },
);
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 2000 },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    deletedAt: Date,
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
messageSchema.index({ conversation: 1, createdAt: -1 });

export const Mentorship = mongoose.model('Mentorship', mentorshipSchema);
export const MentorNote = mongoose.model('MentorNote', mentorNoteSchema);
export const Community = mongoose.model('Community', communitySchema);
export const CommunityMember = mongoose.model('CommunityMember', communityMemberSchema);
export const Conversation = mongoose.model('Conversation', conversationSchema);
export const Message = mongoose.model('Message', messageSchema);
