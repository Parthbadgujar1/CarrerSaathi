import mongoose from 'mongoose';

const { Schema } = mongoose;

const questionSchema = new Schema({
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  options: { type: [{ type: String, trim: true, maxlength: 400 }], validate: (v) => v.length >= 2 && v.length <= 6 },
  correct: { type: Number, required: true, min: 0, max: 5 }, // index into options — never sent to students before grading
  explanation: { type: String, trim: true, maxlength: 1000, default: '' },
  topic: { type: String, trim: true, maxlength: 120, default: '' },
  marks: { type: Number, min: 0.25, max: 20, default: 1 },
});

/** Admin-created test, scheduled and assigned to an audience (empty audience lists = every student). */
const testSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 1500, default: '' },
    instructions: { type: String, trim: true, maxlength: 2000, default: '' },
    source: { type: String, enum: ['excel', 'ai', 'manual', 'mixed'], default: 'manual' },
    questions: { type: [questionSchema], default: [] },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    durationMinutes: { type: Number, min: 5, max: 360, default: 30 },
    passPercent: { type: Number, min: 0, max: 100, default: 40 },
    maxAttempts: { type: Number, min: 1, max: 10, default: 1 },
    shuffleQuestions: { type: Boolean, default: true },
    showResults: { type: String, enum: ['immediate', 'after-end', 'never'], default: 'immediate' },
    audience: {
      degrees: [{ type: String, trim: true, maxlength: 80 }],
      graduationYears: [{ type: Number }],
      currentYears: [{ type: Number }],
      colleges: [{ type: String, trim: true, maxlength: 160 }],
      tracks: [{ type: String, trim: true, maxlength: 80 }],
    },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    notifiedAt: Date,
    reminderSent: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);
testSchema.index({ status: 1, startAt: 1, endAt: 1 });
testSchema.index({ createdBy: 1, createdAt: -1 });

const attemptSchema = new Schema(
  {
    test: { type: Schema.Types.ObjectId, ref: 'Test', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
    startedAt: { type: Date, default: Date.now },
    deadline: { type: Date, required: true },
    submittedAt: Date,
    autoSubmitted: { type: Boolean, default: false },
    order: [{ type: Schema.Types.ObjectId }], // question order shown to this student
    answers: [{ _id: false, q: Schema.Types.ObjectId, choice: Number }],
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    percent: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    timeTakenSec: Number,
  },
  { timestamps: true },
);
attemptSchema.index({ test: 1, user: 1, startedAt: -1 });
attemptSchema.index({ status: 1, deadline: 1 });
attemptSchema.index({ user: 1, submittedAt: -1 });

/** Self-assessment a student runs on their own (AI quiz, or a confidence check built from roadmap steps). */
const practiceSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    roadmap: { type: Schema.Types.ObjectId, ref: 'Roadmap' },
    title: { type: String, maxlength: 160 },
    kind: { type: String, enum: ['quiz', 'confidence'], default: 'quiz' },
    source: { type: String, enum: ['ai', 'cache', 'confidence'], default: 'ai' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    questions: [
      {
        text: String,
        options: [String],
        correct: Number,
        explanation: String,
        topic: String,
      },
    ],
    answers: [Number],
    status: { type: String, enum: ['open', 'submitted'], default: 'open' },
    score: Number,
    total: Number,
    percent: Number,
    submittedAt: Date,
  },
  { timestamps: true },
);
practiceSchema.index({ user: 1, status: 1, createdAt: -1 });
practiceSchema.index({ user: 1, roadmap: 1, submittedAt: -1 });

export const Test = mongoose.model('Test', testSchema);
export const Attempt = mongoose.model('Attempt', attemptSchema);
export const Practice = mongoose.model('Practice', practiceSchema);
