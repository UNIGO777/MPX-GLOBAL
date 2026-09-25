import { AuditLog } from '../models/AuditLog.js';
import { Lead } from '../models/Lead.js';
import { Organisation } from '../models/Organisation.js';
import { Ticket } from '../models/Ticket.js';
import { User } from '../models/User.js';
import { PERMISSIONS, hasTeamScope } from '../config/permissions.js';

/**
 * Step 1e · per-employee "My work" + staff reports (quote Module 6).
 *
 * 🔴 Built ONLY from the append-only AuditLog (and the live ticket / request
 * queues for "assigned to me") — no new data, nothing a person can edit to
 * improve their own numbers.
 *
 * 🔴 Scope: an employee sees ONLY their own row, whatever the request asks
 * (forced here from the token); a superadmin sees the whole team.
 */

/** Report columns → the audit actions each one counts. Order = column order. */
export const REPORT_COLUMNS = [
  { key: 'verifications', label: 'Verifications decided', actions: ['exporter.verify', 'exporter.reject', 'buyer.approve', 'buyer.reject', 'organisation.change_approve', 'organisation.change_reject', 'verification.revoke'] },
  { key: 'documents', label: 'Documents requested / removed', actions: ['kyc.request_documents', 'kyc.document_remove'] },
  { key: 'kycViews', label: 'KYC documents viewed', actions: ['kyc.view'] },
  { key: 'takedowns', label: 'Products taken down / restored', actions: ['product.takedown', 'product.restore', 'product.unblock_reject'] },
  { key: 'chatModeration', label: 'Chats blocked / warned', actions: ['conversation.block', 'conversation.unblock', 'conversation.warn'] },
  { key: 'chatReads', label: 'Conversations read', actions: ['conversation.read'] },
  { key: 'ticketReplies', label: 'Ticket replies', actions: ['ticket.reply'] },
  { key: 'ticketsResolved', label: 'Tickets resolved', actions: [] }, // ticket.status → resolved, counted below
  { key: 'suppliersConnected', label: 'Suppliers connected', actions: ['lead.route'] },
  { key: 'catalogue', label: 'Catalogue changes', actions: ['category.create', 'category.update', 'category.toggle', 'category.delete', 'category.image.upload', 'category.attribute.create', 'category.attribute.update', 'category.attribute.delete'] },
  { key: 'notes', label: 'Internal notes added', actions: ['note.add'] },
];

const ACTION_TO_COLUMN = new Map(REPORT_COLUMNS.flatMap((c) => c.actions.map((a) => [a, c.key])));
const TRACKED = [...ACTION_TO_COLUMN.keys(), 'ticket.status'];
const STAFF_ROLES = ['employee', 'superadmin'];
export const REPORT_WINDOWS = [7, 30, 90];

const emptyCounts = () => Object.fromEntries(REPORT_COLUMNS.map((c) => [c.key, 0]));

async function countsByActor({ since, actorIds }) {
  const match = { occurredAt: { $gte: since }, actorRole: { $in: STAFF_ROLES }, action: { $in: TRACKED } };
  if (actorIds) match.actorId = { $in: actorIds };
  const rows = await AuditLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          actor: '$actorId',
          action: '$action',
          status: { $cond: [{ $eq: ['$action', 'ticket.status'] }, '$after.status', null] },
        },
        n: { $sum: 1 },
      },
    },
  ]);
  const byActor = new Map();
  for (const r of rows) {
    const id = String(r._id.actor);
    if (!byActor.has(id)) byActor.set(id, emptyCounts());
    const counts = byActor.get(id);
    if (r._id.action === 'ticket.status') {
      if (r._id.status === 'resolved') counts.ticketsResolved += r.n;
    } else {
      const col = ACTION_TO_COLUMN.get(r._id.action);
      if (col) counts[col] += r.n;
    }
  }
  return byActor;
}

/**
 * The staff report. `actor` from the token; `actorId` is honoured ONLY for a
 * superadmin. Every active staff member gets a row (zeros included) so an idle
 * account is visible, not missing.
 */
export async function staffReport({ actor, days = 30, actorId, selfOnly = false }) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // The team view: a superadmin, or an employee granted `reports:team`.
  const onlySelf = selfOnly || !hasTeamScope(actor);
  const who = onlySelf ? [actor.userId] : actorId ? [actorId] : null;

  const staff = await User.find({
    role: { $in: STAFF_ROLES },
    ...(who ? { _id: { $in: who } } : { isActive: true }),
  })
    .select('name email role isActive')
    .sort({ role: -1, name: 1 })
    .lean();
  const counts = await countsByActor({ since, actorIds: staff.map((u) => u._id) });

  const rows = staff.map((u) => {
    const c = counts.get(String(u._id)) ?? emptyCounts();
    return {
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      counts: c,
      total: Object.values(c).reduce((a, b) => a + b, 0),
    };
  });
  return {
    days,
    since,
    scope: onlySelf ? 'self' : 'team',
    columns: REPORT_COLUMNS.map(({ key, label }) => ({ key, label })),
    rows,
  };
}

/** "My work" — what is waiting on me right now, plus my last 30 days. */
export async function myWork({ actor }) {
  const perms = new Set(actor.permissions ?? []);
  const isSuper = actor.role === 'superadmin';
  const canTickets = isSuper || perms.has(PERMISSIONS.SUPPORT_READ);
  const canLeads = isSuper || perms.has(PERMISSIONS.LEAD_MANAGE);

  const [tickets, leads, report] = await Promise.all([
    canTickets
      ? Ticket.find({ assignedTo: actor.userId, status: { $ne: 'resolved' } }).sort({ lastMessageAt: -1 }).limit(8).lean()
      : [],
    canLeads
      ? Lead.find({ assignedTo: actor.userId, status: { $in: ['new', 'in_progress'] } }).sort({ createdAt: -1 }).limit(8).lean()
      : [],
    staffReport({ actor, days: 30, selfOnly: true }), // always own row
  ]);

  const orgIds = [...tickets.map((t) => t.orgId), ...leads.map((l) => l.buyerOrgId)].map(String);
  const orgs = new Map(
    (await Organisation.find({ _id: { $in: [...new Set(orgIds)] } }).select('name').lean()).map((o) => [String(o._id), o.name]),
  );

  return {
    canTickets,
    canLeads,
    tickets: tickets.map((t) => ({
      id: String(t._id),
      ref: t.ref,
      subject: t.subject,
      status: t.status,
      unread: Boolean(t.unread?.staff),
      org: orgs.get(String(t.orgId)) ?? '—',
      lastMessageAt: t.lastMessageAt,
    })),
    leads: leads.map((l) => ({
      id: String(l._id),
      ref: l.ref,
      what: l.what,
      status: l.status,
      org: orgs.get(String(l.buyerOrgId)) ?? '—',
      createdAt: l.createdAt,
    })),
    last30: report.rows[0] ?? null,
    columns: report.columns,
  };
}
