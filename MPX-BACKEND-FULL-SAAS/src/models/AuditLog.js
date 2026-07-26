import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';
import { ROLES } from './enums.js';

const { Schema } = mongoose;

const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorRole: { type: String, enum: ROLES },

    action: { type: String, required: true },
    entityType: { type: String },
    entityId: { type: Schema.Types.ObjectId },

    // Optional — platform-level actions have no owning org.
    orgId: { type: Schema.Types.ObjectId, ref: 'Organisation', index: true },

    // Snapshots. Callers MUST redact secrets before writing (no tokens, OTPs,
    // password hashes, bank numbers or KYC values in an audit snapshot).
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },

    ipAddress: { type: String },
    userAgent: { type: String },
    requestId: { type: String },

    // A8: event time set by the service. Differs from createdAt (write time) on a
    // queued write, retry or clock skew — and that difference is itself a signal.
    occurredAt: { type: Date, required: true, default: Date.now, index: true },
  },
  // createdAt = write time (kept). updatedAt is meaningless on an append-only
  // record, so it's disabled.
  { ...baseSchemaOptions, timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ occurredAt: -1 });

declareScope(auditLogSchema, SCOPE.PLATFORM);

// APPEND-ONLY (tracker C10). These app-layer guards catch mistakes in our own
// code; the real guarantee is the database grant — the app's Mongo user has
// insert/find only on this collection, no update or delete. Never relax either.
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
  auditLogSchema.pre(op, function blockMutation() {
    throw new Error(`AuditLog is append-only: "${op}" is not permitted`);
  });
}

// Block modifying an existing document via save(), and document-level deleteOne.
auditLogSchema.pre('save', function blockResave() {
  if (!this.isNew) {
    throw new Error('AuditLog is append-only: existing records cannot be modified');
  }
});
auditLogSchema.pre('deleteOne', { document: true, query: false }, function blockDocDelete() {
  throw new Error('AuditLog is append-only: delete is not permitted');
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
