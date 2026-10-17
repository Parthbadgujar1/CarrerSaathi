import mongoose from 'mongoose';
import { MEETING_TYPES } from '../config/constants.js';

const { Schema } = mongoose;

const meetingSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    type: { type: String, enum: MEETING_TYPES, default: 'seminar' },
    host: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    hostRole: { type: String, enum: ['admin', 'mentor'], required: true },
    startAt: { type: Date, required: true },
    durationMinutes: { type: Number, min: 10, max: 480, default: 60 },
    audience: {
      type: { type: String, enum: ['all', 'students', 'mentors', 'tracks', 'mentees', 'users'], default: 'students' },
      tracks: [{ type: String, maxlength: 80 }],
      users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    },
    mode: { type: String, enum: ['in-portal', 'external'], default: 'in-portal' },
    roomName: { type: String, required: true },
    externalUrl: { type: String, maxlength: 500, default: '' },
    capacity: { type: Number, min: 1, max: 10000, default: 500 },
    attendees: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    status: { type: String, enum: ['scheduled', 'cancelled', 'completed'], default: 'scheduled' },
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true },
);

meetingSchema.index({ status: 1, startAt: 1 });
meetingSchema.index({ host: 1, startAt: -1 });
meetingSchema.index({ 'audience.users': 1 });
meetingSchema.index({ 'audience.tracks': 1 });

meetingSchema.virtual('endAt').get(function endAt() {
  return new Date(this.startAt.getTime() + this.durationMinutes * 60_000);
});

export const Meeting = mongoose.model('Meeting', meetingSchema);
