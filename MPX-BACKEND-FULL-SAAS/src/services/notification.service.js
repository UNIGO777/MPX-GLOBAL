import mongoose from 'mongoose';

import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { emitNotificationsChanged } from '../realtime/socket.js';

/**
 * In-app notifications (B8, web centre — owner override 2026-09-25).
 *
 * 🔴 SENDING NEVER FAILS THE ACTION THAT TRIGGERED IT. A notification is a
 * side effect of something already committed — a verification decision, a
 * reply. `notify` swallows (and logs) its own errors so a notification outage
 * can never turn a successful review into a 500.
 *
 * 🔴 READING IS ALWAYS THE CALLER'S OWN. Every query below filters by the
 * `userId` passed from the verified token; nothing takes a user id from a body
 * or path. A missing or foreign id is a 404, never a 403.
 */

const PAGE = 20;

/**
 * Create (or, with `refKey`, coalesce into) a notification for each user.
 * Fire-and-forget: returns a promise that always resolves.
 */
export async function notify(userIds, { type, title, body = null, link = null, orgId = null, refKey = null }) {
  const ids = [...new Set((userIds ?? []).filter(Boolean).map(String))];
  if (!ids.length) return;
  try {
    const now = new Date();
    for (const id of ids) {
      if (refKey) {
        // One UNREAD row per (person, thing): a busy chat updates its row and
        // bumps it to the top instead of stacking forty "new message" lines.
        await Notification.findOneAndUpdate(
          { userId: id, refKey, readAt: null },
          {
            $set: { type, title, body, link, at: now },
            $inc: { count: 1 },
            $setOnInsert: { userId: id, orgId, refKey },
          },
          { upsert: true, setDefaultsOnInsert: true },
        );
      } else {
        await Notification.create({ userId: id, orgId, type, title, body, link, at: now });
      }
    }
    emitNotificationsChanged(ids);
  } catch (err) {
    logger.warn({ err: { name: err?.name, message: err?.message }, type }, 'notification write failed');
  }
}

/** The active account(s) of a company on one side — the people a company event is for. */
export async function companyUserIds(orgId, role) {
  if (!orgId) return [];
  const users = await User.find({ orgId, role, isActive: true }).select('_id').lean();
  return users.map((u) => String(u._id));
}

/**
 * Active staff who can act on something: every superadmin, plus employees
 * holding ANY of `permissions`. `exceptUserId` drops the person who caused it —
 * nobody needs telling about their own action.
 */
export async function staffUserIds(permissions, { exceptUserId = null } = {}) {
  const users = await User.find({
    isActive: true,
    $or: [{ role: 'superadmin' }, { role: 'employee', permissions: { $in: permissions } }],
  })
    .select('_id')
    .lean();
  return users.map((u) => String(u._id)).filter((id) => id !== String(exceptUserId ?? ''));
}

function view(n) {
  return {
    id: String(n._id),
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
    count: n.count ?? 1,
    at: n.at,
    read: Boolean(n.readAt),
  };
}

const isId = (v) => mongoose.isValidObjectId(v);

/**
 * 🔴 Every read/write below is keyed on the caller's userId. If that were ever
 * missing, Mongoose would DROP the undefined key and the filter would match
 * EVERYONE's rows (e.g. "clear this chat's notice" for every participant).
 * Refuse instead of widening.
 */
function requireUser(userId) {
  if (!userId || !isId(userId)) throw AppError.unauthorized('no user for notifications', 'Not authenticated.');
}

/** Newest first; `before` is the `at` of the last row the client holds. */
export async function listMine({ userId, before, unreadOnly = false }) {
  requireUser(userId);
  const filter = { userId };
  if (unreadOnly) filter.readAt = null;
  if (before) filter.at = { $lt: new Date(before) };
  const rows = await Notification.find(filter).sort({ at: -1, _id: -1 }).limit(PAGE + 1).lean();
  const page = rows.slice(0, PAGE);
  return {
    items: page.map(view),
    nextBefore: rows.length > PAGE ? page[page.length - 1].at : null,
  };
}

export function unreadCount({ userId }) {
  requireUser(userId);
  return Notification.countDocuments({ userId, readAt: null });
}

export async function markRead({ userId, id }) {
  requireUser(userId);
  if (!isId(id)) throw AppError.notFound('notification not found', 'Not found.');
  const res = await Notification.updateOne({ _id: id, userId }, { $set: { readAt: new Date() } });
  if (!res.matchedCount) throw AppError.notFound('notification not found', 'Not found.');
  emitNotificationsChanged([userId]);
  return { ok: true };
}

export async function markAllRead({ userId }) {
  requireUser(userId);
  const res = await Notification.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });
  emitNotificationsChanged([userId]);
  return { updated: res.modifiedCount ?? 0 };
}

/**
 * Opening the thing a notification points at clears it — e.g. reading a chat
 * clears that chat's "new messages" row. Never throws (called from other flows).
 */
export async function markReadByRef({ userId, refKey }) {
  // Silently ignored rather than thrown: this runs inside other flows, and a
  // missing id must never become "mark everyone's rows read".
  if (!userId || !isId(userId) || !refKey) return;
  try {
    const res = await Notification.updateMany({ userId, refKey, readAt: null }, { $set: { readAt: new Date() } });
    if (res.modifiedCount) emitNotificationsChanged([userId]);
  } catch (err) {
    logger.warn({ err: { name: err?.name, message: err?.message } }, 'notification mark-by-ref failed');
  }
}
