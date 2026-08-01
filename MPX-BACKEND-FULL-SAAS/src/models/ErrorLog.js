import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';

const { Schema } = mongoose;

// A19 — the separate error log: ERRORS ONLY (5xx), never a general application
// log and never a second audit trail. Excluded BY CONSTRUCTION (the writer never
// passes them): request bodies, headers, KYC values/URLs, tokens, passwords,
// OTPs, contact details. AuditLog stays permanent; THIS collection expires.
const errorLogSchema = new Schema(
  {
    statusCode: { type: Number, required: true },
    message: { type: String },
    stack: { type: String },
    route: { type: String },
    method: { type: String },
    requestId: { type: String, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    orgId: { type: Schema.Types.ObjectId, ref: 'Organisation' },
    occurredAt: { type: Date, required: true, default: Date.now },
  },
  baseSchemaOptions,
);

// A19: 90-day retention via TTL (AuditLog has NO TTL — do not copy this there).
errorLogSchema.index({ occurredAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// F5 — the viewer's sort. The TTL index above cannot serve it: a single-field
// index does not cover the `_id` tiebreaker, so without this Mongo falls back to
// an in-memory sort that throws once the collection passes the sort limit — i.e.
// the error viewer would break exactly when there are the most errors to read.
errorLogSchema.index({ occurredAt: -1, _id: -1 });

declareScope(errorLogSchema, SCOPE.PLATFORM);

export const ErrorLog = mongoose.model('ErrorLog', errorLogSchema, 'errorLogs');
