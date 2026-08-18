import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';
import { MESSAGE_SENDER_TYPE, MESSAGE_SYSTEM_KIND } from './enums.js';

const { Schema } = mongoose;

// A hard ceiling, NOT the product rule. The real limit is 200 characters and it
// is enforced at the route/socket boundary for NORMAL USER SENDS ONLY (M4-12):
// the composed first enquiry message (structured fields + note) and system
// messages are exempt and will routinely exceed 200. A `maxlength: 200` here
// would reject the thread's own opening message on every single enquiry — which
// is exactly why m4.md §4's "body | max 200 characters" line cannot be taken
// literally. This ceiling exists only so a bug can never write an unbounded blob.
const BODY_CEILING = 4000;

/**
 * M4 — one line sent in a thread.
 *
 * ⚠️ NO OWNER FIELD BY DESIGN. A Message carries no orgId, so `ownershipFilter`
 * cannot be used on it — it is scoped THROUGH its conversation. Every read and
 * write must load the Conversation first, assert the caller's org is in
 * `parties` (404 if not, never 403), and only then touch messages by
 * `conversationId`. Never query a Message by _id alone.
 */
const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },

    senderType: { type: String, enum: MESSAGE_SENDER_TYPE, required: true },

    // Both null for `system` — the platform speaks as itself, with no org and no
    // person behind it (M4-11).
    senderOrgId: { type: Schema.Types.ObjectId, ref: 'Organisation' },
    // Recorded for our own audit trail. NEVER serialised to either party:
    // M4-17 is explicit that threads show COMPANY names, never person names.
    senderUserId: { type: Schema.Types.ObjectId, ref: 'User' },

    body: { type: String, required: true, trim: true, maxlength: BODY_CEILING },

    // Only ever present on a `system` message, and only on ones written after
    // 2026-08-18 — older notices predate the field and cannot be backfilled
    // (M4-13: append-only). Absent means "render it neutrally", not "invalid".
    systemKind: { type: String, enum: MESSAGE_SYSTEM_KIND },
  },
  // updatedAt is meaningless on a record that can never be edited.
  { ...baseSchemaOptions, timestamps: { createdAt: true, updatedAt: false } },
);

// Thread history + cursor pagination (§7.6) read this directly.
messageSchema.index({ conversationId: 1, createdAt: -1, _id: -1 });

declareScope(messageSchema, SCOPE.PLATFORM);

/**
 * APPEND-ONLY (M4-13: "sent messages can never be edited or deleted, by anyone").
 *
 * The absence of a PATCH/DELETE route is not enforcement — it only means nobody
 * has written one yet. These hooks make it impossible for any future code path,
 * script or migration to rewrite chat history, the same guarantee `AuditLog`
 * carries. A conversation frozen or a product purged still keeps every message
 * (M4-22), so nothing in the system has a legitimate reason to delete one.
 */
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
  messageSchema.pre(op, function blockMutation() {
    throw new Error(`Message is append-only (M4-13): "${op}" is not permitted`);
  });
}

messageSchema.pre('save', function blockResave() {
  if (!this.isNew) {
    throw new Error('Message is append-only (M4-13): a sent message cannot be modified');
  }
});

messageSchema.pre('deleteOne', { document: true, query: false }, function blockDocDelete() {
  throw new Error('Message is append-only (M4-13): delete is not permitted');
});

// `bulkWrite` does NOT run query middleware, so every hook above is blind to it —
// verified, not assumed: a `bulkWrite([{ updateOne: ... }])` rewrote a message
// body straight through the guards. That matters here because bulkWrite is
// already an established idiom in this codebase (searchSync.service.js uses it),
// so it is exactly what the next person reaches for. Nothing legitimately needs
// it on this collection — `insertMany` covers bulk inserts. Rejected as a promise
// so it fails the same way as every other blocked operation.
messageSchema.statics.bulkWrite = function blockBulkWrite() {
  return Promise.reject(new Error('Message is append-only (M4-13): bulkWrite is not permitted'));
};

export const Message = mongoose.model('Message', messageSchema);
