import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { withPlatformScope } from './scoping.js';

const { Schema } = mongoose;

/**
 * Step 1c · a staff-only internal note (quote Module 6 "internal notes").
 *
 * 🔴 STAFF-ONLY. Attached to an organisation, a conversation or a support
 * ticket; never serialised into anything a company can read. Platform-scoped:
 * access is by the SUBJECT's own permission, checked in the service.
 *
 * 🔴 APPEND-ONLY, like the audit log: a note is a record of what staff knew and
 * when. A correction is a new note, never an edit. Guarded at the app layer
 * below; there is no update or delete route.
 */
export const NOTE_SUBJECTS = ['organisation', 'conversation', 'ticket', 'lead'];

const internalNoteSchema = new Schema(
  {
    subjectType: { type: String, enum: NOTE_SUBJECTS, required: true },
    subjectId: { type: Schema.Types.ObjectId, required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  baseSchemaOptions,
);

internalNoteSchema.index({ subjectType: 1, subjectId: 1, createdAt: -1 });

withPlatformScope(internalNoteSchema);

const BLOCKED_QUERY_OPS = [
  'updateOne',
  'updateMany',
  'replaceOne',
  'findOneAndUpdate',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
];
for (const op of BLOCKED_QUERY_OPS) {
  internalNoteSchema.pre(op, function blockMutation() {
    throw new Error(`InternalNote is append-only: "${op}" is not permitted`);
  });
}
internalNoteSchema.pre('save', function blockResave() {
  if (!this.isNew) throw new Error('InternalNote is append-only: existing notes cannot be modified');
});
internalNoteSchema.pre('deleteOne', { document: true, query: false }, function blockDocDelete() {
  throw new Error('InternalNote is append-only: delete is not permitted');
});

export const InternalNote = mongoose.model('InternalNote', internalNoteSchema);
