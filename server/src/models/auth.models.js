import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * A login session backed by a rotating refresh token (stored hashed).
 * `family` groups all rotations of one login so token reuse can revoke the
 * whole chain. Expired sessions are purged by a TTL index.
 */
const sessionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    prevTokenHash: { type: String }, // last rotated-out token, for reuse detection
    rotatedAt: Date,
    userAgent: { type: String, maxlength: 300 },
    ipHint: { type: String, maxlength: 64 }, // truncated IP (privacy) for "your devices" view
    remember: { type: Boolean, default: false },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    revokedReason: String,
  },
  { timestamps: true },
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** Single-use tokens for email verification, password reset and mentor invites. */
const tokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['verify_email', 'reset_password', 'invite'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: Date,
  },
  { timestamps: true },
);
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model('Session', sessionSchema);
export const Token = mongoose.model('Token', tokenSchema);
