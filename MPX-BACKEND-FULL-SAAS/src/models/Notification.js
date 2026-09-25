import mongoose from 'mongoose';

import { baseSchemaOptions } from './baseSchema.js';
import { declareScope, SCOPE } from './scoping.js';

const { Schema } = mongoose;

/**
 * In-app notifications — B8 / roadmap Step 2 (quote Module 8), WEB centre.
 * ✅ Built 2026-09-25 on the owner's explicit override of the B8 hold (red alert
 * raised; "Yes, build it for web"; events: company verification, company
 * support + requests, company enquiries + chat, staff work assigned).
 *
 * Owned by ONE user (USER scope): every read and write is filtered by the
 * caller's own `userId` from the token, so one person never sees another's —
 * not even a colleague's in the same organisation.
 *
 * A notification is a POINTER + a short sentence, never a copy of private
 * content: `title`/`body` name what happened, `link` says where to look. The
 * page it links to re-checks access, so a stale or forwarded link shows nothing
 * the reader couldn't already open.
 */
const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orgId: { type: Schema.Types.ObjectId, ref: 'Organisation', index: true },
    // e.g. 'verification.approved', 'ticket.reply', 'chat.message' — a stable
    // key the web uses for the icon; never shown as text.
    type: { type: String, required: true, maxlength: 60 },
    title: { type: String, required: true, maxlength: 160 },
    body: { type: String, maxlength: 300, default: null },
    // An in-app path ("/buyer/support/…", "/admin/leads/…"), never an absolute
    // URL: the web resolves it inside the app, and staff paths are rewritten to
    // the reader's own console (`/admin` or `/staff`).
    link: { type: String, maxlength: 300, default: null },
    // Coalescing key: several events about ONE thing (messages in one chat)
    // update a single unread row instead of stacking a new one each time.
    refKey: { type: String, maxlength: 120, default: null },
    count: { type: Number, default: 1 },
    // Sort key — bumped when a coalesced row is updated, so it rises to the top.
    at: { type: Date, default: () => new Date() },
    readAt: { type: Date, default: null },
    // 90 days, then gone (TTL). A notification is a nudge, not a record — the
    // record of what happened lives in the AuditLog and the thing itself.
    expiresAt: { type: Date, default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
    isActive: { type: Boolean, default: true },
  },
  baseSchemaOptions,
);

notificationSchema.index({ userId: 1, at: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });
notificationSchema.index({ userId: 1, refKey: 1, readAt: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

declareScope(notificationSchema, SCOPE.USER);

export const Notification = mongoose.model('Notification', notificationSchema);
