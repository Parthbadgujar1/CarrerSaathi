import mongoose from 'mongoose';
import { OPPORTUNITY_TYPES, OPPORTUNITY_SOURCES, APPLICATION_STATUSES } from '../config/constants.js';

const { Schema } = mongoose;

const opportunitySchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    organization: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: OPPORTUNITY_TYPES, required: true },
    source: { type: String, enum: OPPORTUNITY_SOURCES, default: 'other' },
    url: { type: String, trim: true, maxlength: 500, default: '' },
    description: { type: String, trim: true, maxlength: 3000, default: '' },
    location: { type: String, trim: true, maxlength: 120, default: '' },
    mode: { type: String, enum: ['remote', 'onsite', 'hybrid'], default: 'remote' },
    compensation: { type: String, trim: true, maxlength: 80, default: '' },
    eligibility: { type: String, trim: true, maxlength: 400, default: '' },
    tracks: [{ type: String, maxlength: 80 }],
    deadline: Date,
    status: { type: String, enum: ['active', 'closed', 'draft'], default: 'active' },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    postedByRole: { type: String, enum: ['admin', 'mentor'] },
    views: { type: Number, default: 0 },
  },
  { timestamps: true },
);

opportunitySchema.index({ status: 1, deadline: 1, createdAt: -1 });
opportunitySchema.index({ tracks: 1, status: 1 });
opportunitySchema.index({ type: 1, status: 1 });
opportunitySchema.index({ postedBy: 1, createdAt: -1 });
opportunitySchema.index(
  { title: 'text', organization: 'text', description: 'text' },
  { weights: { title: 10, organization: 5, description: 1 } },
);

/** A student's personal application tracker entry for an opportunity. */
const applicationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    opportunity: { type: Schema.Types.ObjectId, ref: 'Opportunity', required: true },
    status: { type: String, enum: APPLICATION_STATUSES, default: 'saved' },
    notes: { type: String, maxlength: 1000, default: '' },
  },
  { timestamps: true },
);
applicationSchema.index({ user: 1, opportunity: 1 }, { unique: true });
applicationSchema.index({ opportunity: 1, status: 1 });

export const Opportunity = mongoose.model('Opportunity', opportunitySchema);
export const Application = mongoose.model('Application', applicationSchema);
