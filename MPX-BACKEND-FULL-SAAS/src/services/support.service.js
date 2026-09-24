import { randomBytes } from 'node:crypto';

import mongoose from 'mongoose';
import { fileTypeFromBuffer } from 'file-type';

import { AuditLog } from '../models/AuditLog.js';
import { TICKET_AUTO_CLOSE_DAYS } from '../models/enums.js';
import { Organisation } from '../models/Organisation.js';
import { Ticket } from '../models/Ticket.js';
import { TicketMessage } from '../models/TicketMessage.js';
import { User } from '../models/User.js';
import { PERMISSIONS } from '../config/permissions.js';
import { AppError } from '../utils/AppError.js';
import { recordAudit } from './audit.service.js';
import { uploadChatDocument, uploadChatImage } from './chatAttachment.storage.service.js';
import { notifyTicketReply, notifyTicketResolved } from './emailNotifications.service.js';
import {
  companyMessageView,
  companyTicketView,
  staffMessageView,
  staffTicketView,
} from '../views/ticket.view.js';

/**
 * Step 1b · Support tickets (quote Module 6 "ticket/query queue").
 *
 * 🔴 Company side: every read and write is scoped `{ _id, orgId, side }` from
 * the TOKEN — a missing or foreign ticket is 404, never 403 (A6). `side` too,
 * because one company's buyer and exporter accounts are different people.
 *
 * 🔴 Staff side: permission-gated at the route (`support:read` + the action's
 * own grant — reply / status; assigning others is checked here); tickets are
 * read by id across companies, the same way the moderation surfaces read.
 *
 * Every action writes ONE AuditLog row (entityType `ticket`) — that trail IS the
 * "who did what" ticket log, and it is append-only (C10).
 */

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const AUTO_CLOSE_DAYS = TICKET_AUTO_CLOSE_DAYS;
const DAY_MS = 24 * 60 * 60 * 1000;
const COMPANY_ROLES = new Set(['buyer', 'exporter']);

function newRef() {
  const bytes = randomBytes(6);
  return `T-${Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join('')}`;
}

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A buyer/exporter account's side. Superadmin passes `requireRole`, so refuse here. */
function companySide(user) {
  if (!COMPANY_ROLES.has(user.role) || !user.orgId) {
    throw AppError.forbidden('not a company account', 'Only buyer and exporter accounts can use support tickets.');
  }
  return user.role;
}

function actorOf(user) {
  return { userId: user.userId, role: user.role };
}

/**
 * Store an optional file under the ticket's own folder, through the SAME checks
 * as chat (magic bytes, size, macro/script screen, private storage). Image vs
 * document is decided by the true content type, never the filename.
 */
async function storeFile(file, ticketId) {
  if (!file?.buffer) return null;
  const folder = `mpx/support/${ticketId}`;
  const sniffed = await fileTypeFromBuffer(file.buffer);
  if (sniffed?.mime?.startsWith('image/')) {
    const r = await uploadChatImage({ buffer: file.buffer, folder });
    return { kind: 'image', storageKey: r.storageKey, format: r.format, mime: r.mime, bytes: r.bytes, width: r.width, height: r.height };
  }
  const d = await uploadChatDocument({ buffer: file.buffer, originalName: file.originalname, folder });
  return { kind: 'document', storageKey: d.storageKey, format: d.format, mime: d.mime, bytes: d.bytes, name: d.name };
}

function requireContent(body, file) {
  if (!String(body ?? '').trim() && !file?.buffer) {
    throw AppError.badRequest('empty message', 'Write a message or attach a file.');
  }
}

async function loadNames(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const users = await User.find({ _id: { $in: unique } }).select('name email').lean();
  return new Map(users.map((u) => [String(u._id), { name: u.name, email: u.email }]));
}

async function loadOrgs(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (!unique.length) return new Map();
  const orgs = await Organisation.find({ _id: { $in: unique } }).select('name slug').lean();
  return new Map(orgs.map((o) => [String(o._id), { name: o.name, slug: o.slug }]));
}

function audit(user, action, ticket, { before, after, meta } = {}) {
  return recordAudit({
    actor: actorOf(user),
    action,
    entityType: 'ticket',
    entityId: ticket._id,
    orgId: ticket.orgId,
    before,
    after: { ref: ticket.ref, ...(after ?? {}) },
    meta,
  });
}

// ─────────────────────────────── company side ───────────────────────────────

export async function createTicket({ user, subject, category, body, file, followUpOf, meta }) {
  const side = companySide(user);
  requireContent(body, file);
  // A follow-up may only point at this account's OWN ticket (same org + side);
  // anything else is 404, checked before a file is stored.
  let followUp = null;
  if (followUpOf) {
    followUp = await Ticket.findOne({ _id: followUpOf, orgId: user.orgId, side }).select('ref').lean();
    if (!followUp) throw AppError.notFound('follow-up ticket not found', 'Ticket not found.');
  }

  const _id = new mongoose.Types.ObjectId();
  const attachment = await storeFile(file, _id);

  let ticket;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      ticket = await Ticket.create({
        _id,
        orgId: user.orgId,
        side,
        createdBy: user.userId,
        ref: newRef(),
        subject,
        category,
        status: 'open',
        lastMessageAt: new Date(),
        unread: { company: false, staff: true },
        followUpOf: followUp?._id ?? null,
        followUpRef: followUp?.ref ?? null,
      });
      break;
    } catch (err) {
      // A ref collision (1 in ~10^9) — pick another; anything else is real.
      if (err?.code !== 11000 || attempt === 2) throw err;
    }
  }

  const message = await TicketMessage.create({
    ticketId: ticket._id,
    orgId: user.orgId,
    authorType: 'company',
    authorId: user.userId,
    body: body ?? '',
    attachment,
  });

  await audit(user, 'ticket.create', ticket, { after: { category, side, ...(followUp ? { followUpOf: followUp.ref } : {}) }, meta });
  return { ticket: companyTicketView(ticket), messages: [companyMessageView(message)] };
}

export async function listMyTickets({ user, status, page = 1, pageSize = 20 }) {
  const side = companySide(user);
  const filter = { orgId: user.orgId, side, ...(status ? { status } : {}) };
  const [rows, total] = await Promise.all([
    Ticket.find(filter).sort({ lastMessageAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Ticket.countDocuments(filter),
  ]);
  return { rows: rows.map(companyTicketView), total, page, pageSize };
}

async function findMine(user, id) {
  const side = companySide(user);
  const ticket = await Ticket.findOne({ _id: id, orgId: user.orgId, side });
  if (!ticket) throw AppError.notFound('ticket not found', 'Ticket not found.');
  return ticket;
}

export async function getMyTicket({ user, id }) {
  const ticket = await findMine(user, id);
  const messages = await TicketMessage.find({ ticketId: ticket._id, orgId: user.orgId }).sort({ createdAt: 1 }).lean();
  if (ticket.unread?.company) {
    await Ticket.updateOne({ _id: ticket._id, orgId: user.orgId }, { $set: { 'unread.company': false } });
    ticket.unread.company = false;
  }
  return { ticket: companyTicketView(ticket), messages: messages.map(companyMessageView) };
}

export async function replyMyTicket({ user, id, body, file, meta }) {
  const ticket = await findMine(user, id);
  // Resolved means closed for the company (owner, 2026-09-24): more help is a
  // NEW ticket. Refused before the file is stored, so nothing is uploaded.
  if (ticket.status === 'resolved') {
    throw AppError.conflict(
      'ticket resolved',
      'This ticket is closed. Raise a new ticket if you still need help.',
      'TICKET_CLOSED',
    );
  }
  requireContent(body, file);
  const attachment = await storeFile(file, ticket._id);

  await TicketMessage.create({
    ticketId: ticket._id,
    orgId: user.orgId,
    authorType: 'company',
    authorId: user.userId,
    body: body ?? '',
    attachment,
  });

  // An ongoing ticket keeps its status — the reply only lifts it to the top of
  // the staff queue with a "new reply" flag.
  await Ticket.updateOne(
    { _id: ticket._id, orgId: user.orgId },
    { $set: { lastMessageAt: new Date(), 'unread.staff': true, 'unread.company': false, awaitingCompanySince: null } },
  );

  await audit(user, 'ticket.reply', ticket, { after: { by: 'company' }, meta });
  return getMyTicket({ user, id });
}

/**
 * "Mark as solved" — the company closes its own ticket. Same closed state as a
 * staff resolve (no more company replies); logged as the company's action. No
 * email: they did it themselves.
 */
export async function closeMyTicket({ user, id, meta }) {
  const ticket = await findMine(user, id);
  if (ticket.status !== 'resolved') {
    await Ticket.updateOne(
      { _id: ticket._id, orgId: user.orgId },
      { $set: { status: 'resolved', resolvedAt: new Date(), closedBy: 'company', awaitingCompanySince: null } },
    );
    await audit(user, 'ticket.status', ticket, { before: { status: ticket.status }, after: { status: 'resolved', by: 'company' }, meta });
  }
  return getMyTicket({ user, id });
}

/** The company's own count of tickets with a new support reply — for the nav badge. */
export async function myUnreadCount({ user }) {
  const side = companySide(user);
  return Ticket.countDocuments({ orgId: user.orgId, side, 'unread.company': true });
}

// ──────────────────────────────── staff side ────────────────────────────────

async function findAny(id) {
  // Staff surface: permission-gated at the route, reads across companies by id —
  // the same shape the moderation screens use (never `findById`, per the A6 lint).
  const ticket = await Ticket.findOne({ _id: id });
  if (!ticket) throw AppError.notFound('ticket not found', 'Ticket not found.');
  return ticket;
}

export async function listTickets({ actor, status, category, side, assignee, q, page = 1, pageSize = 20 }) {
  const filter = {};
  // Virtual views (the stat cards): 'active' = not resolved; 'needs_reply' = the
  // company wrote last and staff have not read it; 'waiting' = staff wrote last
  // and the auto-close clock is running.
  if (status === 'active') filter.status = { $ne: 'resolved' };
  else if (status === 'needs_reply') Object.assign(filter, { status: { $ne: 'resolved' }, 'unread.staff': true });
  else if (status === 'waiting') Object.assign(filter, { status: { $ne: 'resolved' }, awaitingCompanySince: { $ne: null } });
  else if (status) filter.status = status;
  if (category) filter.category = category;
  if (side) filter.side = side;
  if (assignee === 'me') filter.assignedTo = actor.userId;
  else if (assignee === 'unassigned') filter.assignedTo = null;
  else if (assignee) filter.assignedTo = assignee;
  if (q) {
    const term = String(q).trim();
    // A ref ("T-4F9K2Q") matches exactly; anything else is a subject prefix.
    filter.$or = [{ ref: term.toUpperCase() }, { subject: new RegExp(`^${escapeRegex(term)}`, 'i') }];
  }

  const [rows, total] = await Promise.all([
    Ticket.find(filter).sort({ lastMessageAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Ticket.countDocuments(filter),
  ]);
  const [names, orgs] = await Promise.all([
    loadNames(rows.flatMap((t) => [t.createdBy, t.assignedTo])),
    loadOrgs(rows.map((t) => t.orgId)),
  ]);
  return { rows: rows.map((t) => staffTicketView(t, { names, orgs })), total, page, pageSize };
}

export async function getTicket({ id }) {
  const ticket = await findAny(id);
  const messages = await TicketMessage.find({ ticketId: ticket._id, orgId: ticket.orgId }).sort({ createdAt: 1 }).lean();
  const names = await loadNames([...messages.map((m) => m.authorId), ticket.createdBy, ticket.assignedTo]);
  if (ticket.unread?.staff) {
    await Ticket.updateOne({ _id: ticket._id }, { $set: { 'unread.staff': false } });
    ticket.unread.staff = false;
  }
  return {
    ticket: staffTicketView(ticket, { names, orgs: await loadOrgs([ticket.orgId]) }),
    messages: messages.map((m) => staffMessageView(m, names)),
  };
}

/**
 * A staff reply. It also moves the ticket along the way a support desk expects:
 * an OPEN ticket becomes IN PROGRESS, and an unassigned one is taken by the
 * replier — each written to the log as its own action, so the trail says so.
 */
export async function replyTicket({ actor, id, body, file, meta }) {
  const ticket = await findAny(id);
  // A staff reply on a CLOSED ticket re-opens it, so it needs the re-open grant
  // too (owner, 2026-09-24). Checked before any file is stored.
  if (
    ticket.status === 'resolved' &&
    actor.role !== 'superadmin' &&
    !(actor.permissions ?? []).includes(PERMISSIONS.SUPPORT_STATUS)
  ) {
    throw AppError.forbidden('reply would re-open', 'This ticket is closed. Replying would re-open it, which needs the "Resolve / re-open tickets" permission.');
  }
  requireContent(body, file);
  const attachment = await storeFile(file, ticket._id);

  await TicketMessage.create({
    ticketId: ticket._id,
    orgId: ticket.orgId,
    authorType: 'staff',
    authorId: actor.userId,
    body: body ?? '',
    attachment,
  });

  const set = { lastMessageAt: new Date(), 'unread.company': true, 'unread.staff': false };
  const took = !ticket.assignedTo;
  // Open → in progress on the first staff reply. A staff reply on a RESOLVED
  // ticket re-opens it too — the company cannot reply to a closed ticket, so
  // leaving it resolved would send a message they cannot answer.
  const advanced = ticket.status !== 'in_progress';
  set.awaitingCompanySince = new Date();
  if (took) set.assignedTo = actor.userId;
  if (advanced) Object.assign(set, { status: 'in_progress', resolvedAt: null, closedBy: null });
  await Ticket.updateOne({ _id: ticket._id }, { $set: set });

  await audit(actor, 'ticket.reply', ticket, { after: { by: 'staff' }, meta });
  if (took) await audit(actor, 'ticket.assign', ticket, { before: { assignedTo: null }, after: { assignedTo: String(actor.userId) }, meta });
  if (advanced) await audit(actor, 'ticket.status', ticket, { before: { status: ticket.status }, after: { status: 'in_progress' }, meta });

  notifyTicketReply({ ticket });
  return getTicket({ id });
}

export async function setTicketStatus({ actor, id, status, meta }) {
  const ticket = await findAny(id);
  if (ticket.status === status) return getTicket({ id });
  const before = ticket.status;
  const resolving = status === 'resolved';
  const reopening = before === 'resolved';
  const set = { status, resolvedAt: resolving ? new Date() : null, closedBy: resolving ? 'staff' : null };
  // Resolving or re-opening is news for the company: it lights their "new"
  // badge. A staff re-open also starts the auto-close clock again.
  if (resolving || reopening) set['unread.company'] = true;
  if (resolving) set.awaitingCompanySince = null;
  if (reopening) set.awaitingCompanySince = new Date();
  await Ticket.updateOne({ _id: ticket._id }, { $set: set });
  await audit(actor, 'ticket.status', ticket, { before: { status: before }, after: { status }, meta });
  if (resolving) notifyTicketResolved({ ticket });
  return getTicket({ id });
}

/**
 * The nightly sweep: a ticket where staff wrote last (or re-opened it) and the
 * company has not answered for AUTO_CLOSE_DAYS closes itself. System action —
 * no acting user — written to the append-only log with a job request id, and
 * the company gets the (existing) "resolved" email, worded for this case.
 * Each close re-checks its own condition, so a company reply that lands during
 * the sweep wins. `now` is injectable for tests.
 */
export async function autoCloseStaleTickets({ now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - AUTO_CLOSE_DAYS * DAY_MS);
  const stale = await Ticket.find({ status: { $ne: 'resolved' }, awaitingCompanySince: { $ne: null, $lte: cutoff } });
  let closed = 0;
  for (const ticket of stale) {
    const res = await Ticket.updateOne(
      { _id: ticket._id, status: { $ne: 'resolved' }, awaitingCompanySince: { $ne: null, $lte: cutoff } },
      { $set: { status: 'resolved', resolvedAt: now, closedBy: 'auto', awaitingCompanySince: null, 'unread.company': true } },
    );
    if (!res.modifiedCount) continue;
    await AuditLog.create({
      actorId: null, // system job — no acting user
      action: 'ticket.status',
      entityType: 'ticket',
      entityId: ticket._id,
      orgId: ticket.orgId,
      before: { status: ticket.status },
      after: { ref: ticket.ref, status: 'resolved', by: 'auto', afterDays: AUTO_CLOSE_DAYS },
      requestId: 'job:ticket-auto-close',
      occurredAt: now,
    });
    notifyTicketResolved({ ticket, auto: true });
    closed += 1;
  }
  return { closed };
}

/** Staff a ticket can go to: active superadmins + employees who can READ and REPLY. */
export async function assignableStaff() {
  const users = await User.find({
    isActive: true,
    $or: [{ role: 'superadmin' }, { role: 'employee', permissions: { $all: [PERMISSIONS.SUPPORT_READ, PERMISSIONS.SUPPORT_REPLY] } }],
  })
    .select('name role')
    .sort({ name: 1 })
    .lean();
  return users.map((u) => ({ id: String(u._id), name: u.name, role: u.role }));
}

export async function assignTicket({ actor, id, assigneeId, meta }) {
  const ticket = await findAny(id);
  // Without `support:assign`, staff may only TAKE an unassigned ticket for
  // themselves — never hand one to someone else, never take over another's.
  if (actor.role !== 'superadmin' && !(actor.permissions ?? []).includes(PERMISSIONS.SUPPORT_ASSIGN)) {
    const self = String(assigneeId) === String(actor.userId);
    // Taking a ticket means answering it — a read-only grant cannot take one.
    if (self && !(actor.permissions ?? []).includes(PERMISSIONS.SUPPORT_REPLY)) {
      throw AppError.forbidden('no support:reply', 'You can view tickets, but not take them.');
    }
    if (!self || ticket.assignedTo) {
      throw AppError.forbidden('no support:assign', 'You can take an unassigned ticket, but not assign tickets to others.');
    }
  }
  if (assigneeId) {
    const ok = await User.exists({
      _id: assigneeId,
      isActive: true,
      $or: [{ role: 'superadmin' }, { role: 'employee', permissions: { $all: [PERMISSIONS.SUPPORT_READ, PERMISSIONS.SUPPORT_REPLY] } }],
    });
    if (!ok) throw AppError.badRequest('bad assignee', 'That person cannot take support tickets.');
  }
  const before = ticket.assignedTo ? String(ticket.assignedTo) : null;
  const next = assigneeId ? String(assigneeId) : null;
  if (before === next) return getTicket({ id });
  await Ticket.updateOne({ _id: ticket._id }, { $set: { assignedTo: next } });
  await audit(actor, 'ticket.assign', ticket, { before: { assignedTo: before }, after: { assignedTo: next }, meta });
  return getTicket({ id });
}

// ─────────────────────────── dashboard + ticket log ──────────────────────────

/** The super admin dashboard's Support section. */
export async function supportOverview() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [open, inProgress, unassigned, needsReply, waiting, resolved7d, openRows] = await Promise.all([
    Ticket.countDocuments({ status: 'open' }),
    Ticket.countDocuments({ status: 'in_progress' }),
    Ticket.countDocuments({ status: { $ne: 'resolved' }, assignedTo: null }),
    Ticket.countDocuments({ status: { $ne: 'resolved' }, 'unread.staff': true }),
    Ticket.countDocuments({ status: { $ne: 'resolved' }, awaitingCompanySince: { $ne: null } }),
    Ticket.countDocuments({ status: 'resolved', resolvedAt: { $gte: since } }),
    Ticket.find({ status: { $ne: 'resolved' } }).sort({ lastMessageAt: -1 }).limit(10).lean(),
  ]);
  const [names, orgs] = await Promise.all([
    loadNames(openRows.flatMap((t) => [t.createdBy, t.assignedTo])),
    loadOrgs(openRows.map((t) => t.orgId)),
  ]);
  return {
    counts: { open, inProgress, unassigned, needsReply, waiting, resolved7d },
    openTickets: openRows.map((t) => staffTicketView(t, { names, orgs })),
  };
}

const LOG_ACTIONS = ['ticket.create', 'ticket.reply', 'ticket.assign', 'ticket.status', 'ticket.reopen'];

async function logRows(filter, page, pageSize) {
  const [rows, total] = await Promise.all([
    // `_id` breaks ties: one staff reply writes up to three rows in the same
    // millisecond (reply → assign → status), and a timeline must keep them in
    // the order they happened, not shuffle them.
    AuditLog.find(filter).sort({ occurredAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    AuditLog.countDocuments(filter),
  ]);
  const people = new Set(rows.filter((r) => r.actorId).map((r) => String(r.actorId)));
  for (const r of rows) {
    for (const v of [r.before?.assignedTo, r.after?.assignedTo]) if (v) people.add(String(v));
  }
  const [names, tickets] = await Promise.all([
    loadNames([...people]),
    Ticket.find({ _id: { $in: rows.map((r) => r.entityId) } }).select('ref subject orgId').lean(),
  ]);
  const byId = new Map(tickets.map((t) => [String(t._id), t]));
  const orgs = await loadOrgs(tickets.map((t) => t.orgId));
  const nameOf = (id) => (id ? names.get(String(id))?.name ?? '—' : null);
  return {
    rows: rows.map((r) => {
      const t = byId.get(String(r.entityId));
      return {
        id: String(r._id),
        at: r.occurredAt,
        action: r.action,
        actor: r.actorId
          ? { id: String(r.actorId), name: nameOf(r.actorId), role: r.actorRole }
          : { id: null, name: 'Automatic', role: 'system' },
        ticket: t ? { id: String(t._id), ref: t.ref, subject: t.subject, org: orgs.get(String(t.orgId))?.name ?? '—' } : null,
        from: r.before?.status ?? (r.action === 'ticket.assign' ? nameOf(r.before?.assignedTo) : null),
        to: r.after?.status ?? (r.action === 'ticket.assign' ? nameOf(r.after?.assignedTo) : null),
        by: r.after?.by ?? null,
      };
    }),
    total,
    page,
    pageSize,
  };
}

/** One ticket's timeline — every action on it, oldest first. */
export async function ticketTimeline({ id }) {
  const ticket = await findAny(id);
  const res = await logRows({ entityType: 'ticket', entityId: ticket._id, action: { $in: LOG_ACTIONS } }, 1, 500);
  return res.rows.reverse();
}

/**
 * The cross-ticket log ("who resolved what"). 🔴 A superadmin — or an employee
 * holding `reports:team` — sees the whole team; anyone else sees ONLY their own
 * actions: the actor filter is forced from the token, whatever the request asked.
 */
export async function ticketLog({ actor, actorId, action, from, to, page = 1, pageSize = 50 }) {
  const filter = { entityType: 'ticket', action: action ? action : { $in: LOG_ACTIONS } };
  // The whole team: a superadmin, or an employee granted `reports:team`
  // (owner, 2026-09-24). Anyone else sees only their own actions.
  const seesTeam = actor.role === 'superadmin' || (actor.permissions ?? []).includes(PERMISSIONS.REPORTS_TEAM);
  if (!seesTeam) filter.actorId = actor.userId;
  else if (actorId) filter.actorId = actorId;
  if (from || to) {
    filter.occurredAt = {};
    if (from) filter.occurredAt.$gte = new Date(from);
    if (to) filter.occurredAt.$lte = new Date(to);
  }
  return logRows(filter, page, pageSize);
}
