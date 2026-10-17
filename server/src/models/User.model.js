import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLE_LIST, USER_STATUS, DEGREE_LEVELS } from '../config/constants.js';

const { Schema } = mongoose;

const urlField = { type: String, trim: true, maxlength: 300, default: '' };

const educationSchema = new Schema(
  {
    level: { type: String, enum: DEGREE_LEVELS, default: 'UG' },
    degree: { type: String, trim: true, maxlength: 80, default: '' }, // e.g. B.Tech, BBA, B.Sc
    branch: { type: String, trim: true, maxlength: 80, default: '' }, // e.g. CSE, Finance
    college: { type: String, trim: true, maxlength: 160, default: '' },
    university: { type: String, trim: true, maxlength: 160, default: '' },
    graduationYear: { type: Number, min: 1990, max: 2100 },
    currentYear: { type: Number, min: 1, max: 6 },
    cgpa: { type: Number, min: 0, max: 10 },
  },
  { _id: false },
);

const addressSchema = new Schema(
  {
    line1: { type: String, trim: true, maxlength: 200, default: '' },
    city: { type: String, trim: true, maxlength: 80, default: '' },
    state: { type: String, trim: true, maxlength: 80, default: '' },
    pincode: { type: String, trim: true, maxlength: 10, default: '' },
    country: { type: String, trim: true, maxlength: 60, default: 'India' },
  },
  { _id: false },
);

const resumeSchema = new Schema(
  {
    summary: { type: String, maxlength: 1200, default: '' },
    experience: [
      {
        _id: false,
        title: { type: String, maxlength: 120 },
        organization: { type: String, maxlength: 120 },
        start: { type: String, maxlength: 20 },
        end: { type: String, maxlength: 20 },
        description: { type: String, maxlength: 1000 },
      },
    ],
    projects: [
      {
        _id: false,
        name: { type: String, maxlength: 120 },
        link: { type: String, maxlength: 300 },
        tech: { type: String, maxlength: 200 },
        description: { type: String, maxlength: 1000 },
      },
    ],
    certifications: [
      {
        _id: false,
        name: { type: String, maxlength: 160 },
        issuer: { type: String, maxlength: 120 },
        year: { type: String, maxlength: 10 },
        link: { type: String, maxlength: 300 },
      },
    ],
    achievements: [{ type: String, maxlength: 300 }],
    updatedAt: Date,
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    password: { type: String, select: false },
    role: { type: String, enum: ROLE_LIST, default: 'student', index: true },
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.ACTIVE },
    emailVerified: { type: Boolean, default: false },

    headline: { type: String, trim: true, maxlength: 140, default: '' },
    bio: { type: String, trim: true, maxlength: 1000, default: '' },
    education: { type: educationSchema, default: () => ({}) },
    address: { type: addressSchema, default: () => ({}) },
    careerTracks: [{ type: String, trim: true, maxlength: 80 }],
    skills: [{ type: String, trim: true, maxlength: 50 }],
    interests: [{ type: String, trim: true, maxlength: 50 }],
    links: {
      linkedin: urlField,
      github: urlField,
      portfolio: urlField,
      codingProfile: urlField,
      resumeUrl: urlField,
    },
    careerKit: { type: Map, of: Boolean, default: () => new Map() },
    resume: { type: resumeSchema, default: () => ({}) },
    readinessScore: { type: Number, default: 0, min: 0, max: 100 },

    mentorProfile: {
      designation: { type: String, trim: true, maxlength: 100, default: '' },
      company: { type: String, trim: true, maxlength: 120, default: '' },
      expertise: [{ type: String, trim: true, maxlength: 60 }],
      experienceYears: { type: Number, min: 0, max: 60, default: 0 },
      maxMentees: { type: Number, min: 1, max: 200, default: 25 },
      availability: { type: String, trim: true, maxlength: 200, default: '' },
      approvedAt: Date,
      approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },

    consents: {
      termsVersion: String,
      privacyVersion: String,
      acceptedAt: Date,
      marketingEmails: { type: Boolean, default: false },
      wellnessShareWithMentor: { type: Boolean, default: false },
    },
    preferences: {
      emailNotifications: { type: Boolean, default: true },
    },
    acquisition: {
      utmSource: { type: String, maxlength: 100 },
      utmMedium: { type: String, maxlength: 100 },
      utmCampaign: { type: String, maxlength: 100 },
      referrer: { type: String, maxlength: 300 },
      landingPage: { type: String, maxlength: 300 },
    },
    security: {
      failedLoginAttempts: { type: Number, default: 0 },
      lockUntil: Date,
      passwordChangedAt: Date,
      lastLoginAt: Date,
    },
    deletion: {
      requestedAt: Date,
      scheduledFor: Date,
      reason: { type: String, maxlength: 500 },
    },
    unsubscribeToken: { type: String, select: false },
    lastActiveAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      flattenMaps: true,
      virtuals: false,
      transform(_doc, ret) {
        delete ret.password;
        delete ret.unsubscribeToken;
        delete ret.__v;
        if (ret.security) delete ret.security.failedLoginAttempts;
        return ret;
      },
    },
  },
);

// ---- Indexes (query patterns: admin filters, mentor directory, search) ----
userSchema.index({ role: 1, status: 1, createdAt: -1 });
userSchema.index({ 'education.college': 1 });
userSchema.index({ careerTracks: 1 });
userSchema.index({ 'mentorProfile.expertise': 1 });
userSchema.index({ 'deletion.scheduledFor': 1 }, { sparse: true });
userSchema.index({ name: 'text', email: 'text', 'education.college': 'text', skills: 'text' });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.security.passwordChangedAt = new Date(Date.now() - 1000);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.security?.lockUntil && this.security.lockUntil > new Date());
};

export const User = mongoose.model('User', userSchema);
