import mongoose from 'mongoose';
import { ROADMAP_CATEGORIES } from '../config/constants.js';

const { Schema } = mongoose;

const resourceSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 160 },
    url: { type: String, required: true, maxlength: 400 },
    type: { type: String, enum: ['course', 'doc', 'video', 'practice', 'book', 'community', 'tool'], default: 'course' },
    free: { type: Boolean, default: true },
  },
  { _id: false },
);

const stepSchema = new Schema(
  {
    key: { type: String, required: true, maxlength: 80 }, // stable id used for progress tracking
    title: { type: String, required: true, maxlength: 160 },
    description: { type: String, maxlength: 800, default: '' },
    isProject: { type: Boolean, default: false },
    resources: { type: [resourceSchema], default: [] },
  },
  { _id: false },
);

const phaseSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 120 },
    duration: { type: String, maxlength: 40, default: '' },
    steps: { type: [stepSchema], default: [] },
  },
  { _id: false },
);

const roadmapSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 100 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, enum: ROADMAP_CATEGORIES, default: 'Technology' },
    summary: { type: String, maxlength: 400, default: '' },
    description: { type: String, maxlength: 2000, default: '' },
    icon: { type: String, maxlength: 40, default: 'Compass' },
    duration: { type: String, maxlength: 40, default: '' },
    suitableFor: [{ type: String, maxlength: 60 }], // degrees e.g. B.Tech, BBA, B.Com
    roles: [{ type: String, maxlength: 80 }], // entry-level job roles
    skills: [{ type: String, maxlength: 60 }], // used by the skill-gap analyser
    keywords: [{ type: String, lowercase: true, maxlength: 60 }], // used for library matching
    careerKit: [{ key: String, label: String, _id: false }], // track-specific readiness items
    phases: { type: [phaseSchema], default: [] },
    source: { type: String, enum: ['system', 'admin', 'ai'], default: 'system' },
    aiProvider: String,
    owner: { type: Schema.Types.ObjectId, ref: 'User' }, // set for private AI roadmaps
    isPublished: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

roadmapSchema.index({ isPublished: 1, category: 1 });
roadmapSchema.index({ owner: 1 }, { sparse: true });
roadmapSchema.index(
  { title: 'text', summary: 'text', keywords: 'text', skills: 'text', roles: 'text' },
  { weights: { title: 10, keywords: 6, roles: 4, skills: 3, summary: 1 } },
);

roadmapSchema.virtual('totalSteps').get(function totalSteps() {
  return (this.phases || []).reduce((n, p) => n + (p.steps?.length || 0), 0);
});

/** Student progress on a roadmap. */
const enrollmentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    roadmap: { type: Schema.Types.ObjectId, ref: 'Roadmap', required: true },
    completed: [{ key: String, at: { type: Date, default: Date.now }, _id: false }],
    progress: { type: Number, default: 0, min: 0, max: 100 },
    status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
    targetDate: Date,
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
enrollmentSchema.index({ user: 1, roadmap: 1 }, { unique: true });
enrollmentSchema.index({ user: 1, status: 1 });

export const Roadmap = mongoose.model('Roadmap', roadmapSchema);
export const Enrollment = mongoose.model('Enrollment', enrollmentSchema);
