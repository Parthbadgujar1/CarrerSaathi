import mongoose from 'mongoose';

const { Schema } = mongoose;
const DAY = 86_400;

/** Daily wellbeing check-in. One per user per day; journal is encrypted at rest. */
const wellnessLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    day: { type: String, required: true }, // YYYY-MM-DD (IST)
    mood: { type: Number, min: 1, max: 5, required: true },
    stress: { type: Number, min: 1, max: 5 },
    sleepHours: { type: Number, min: 0, max: 24 },
    exerciseMinutes: { type: Number, min: 0, max: 600 },
    waterGlasses: { type: Number, min: 0, max: 30 },
    screenHours: { type: Number, min: 0, max: 24 },
    journal: { type: String, maxlength: 6000 }, // ciphertext
  },
  { timestamps: true },
);
wellnessLogSchema.index({ user: 1, day: -1 }, { unique: true });

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, maxlength: 40, default: 'info' },
    title: { type: String, required: true, maxlength: 160 },
    body: { type: String, maxlength: 500, default: '' },
    link: { type: String, maxlength: 300, default: '' },
    readAt: Date,
  },
  { timestamps: true },
);
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * DAY });

const contactMessageSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    email: { type: String, required: true, maxlength: 160 },
    subject: { type: String, maxlength: 140, default: '' },
    message: { type: String, required: true, maxlength: 3000 },
    status: { type: String, enum: ['new', 'resolved'], default: 'new' },
  },
  { timestamps: true },
);
contactMessageSchema.index({ status: 1, createdAt: -1 });
contactMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * DAY });

const deletionRequestSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    email: { type: String, required: true, maxlength: 160 },
    reason: { type: String, maxlength: 500, default: '' },
    status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
    scheduledFor: Date,
    processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    processedAt: Date,
  },
  { timestamps: true },
);
deletionRequestSchema.index({ status: 1, scheduledFor: 1 });

const auditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorEmail: String,
    action: { type: String, required: true, maxlength: 80 },
    targetType: { type: String, maxlength: 40 },
    targetId: { type: String, maxlength: 64 },
    meta: Schema.Types.Mixed,
    requestId: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * DAY, name: 'audit_ttl' });

/** Persistent, shared AI response cache — identical requests cost nothing. */
const aiCacheSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    kind: { type: String, required: true },
    payload: Schema.Types.Mixed,
    provider: String,
    hits: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
aiCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** One row per AI call (cached or not) — powers quotas and the admin AI dashboard. */
const aiLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    kind: { type: String, maxlength: 40 },
    source: { type: String, enum: ['ai', 'cache', 'library', 'rules'] },
    provider: String,
    success: Boolean,
    latencyMs: Number,
    error: { type: String, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
aiLogSchema.index({ user: 1, createdAt: -1 });
aiLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * DAY });

/** Transactional outbox for email: sending never blocks a request and failures are retried. */
const emailOutboxSchema = new Schema(
  {
    to: { type: String, required: true },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    text: String,
    template: String,
    status: { type: String, enum: ['queued', 'sending', 'sent', 'failed'], default: 'queued' },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lastError: { type: String, maxlength: 500 },
    sentAt: Date,
    transport: String,
  },
  { timestamps: true },
);
emailOutboxSchema.index({ status: 1, nextAttemptAt: 1 });
emailOutboxSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * DAY });

/** Admin-editable runtime settings (single document per key). */
const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: Schema.Types.Mixed,
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const WellnessLog = mongoose.model('WellnessLog', wellnessLogSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);
export const DeletionRequest = mongoose.model('DeletionRequest', deletionRequestSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export const AiCache = mongoose.model('AiCache', aiCacheSchema);
export const AiLog = mongoose.model('AiLog', aiLogSchema);
export const EmailOutbox = mongoose.model('EmailOutbox', emailOutboxSchema);
export const Setting = mongoose.model('Setting', settingSchema);
