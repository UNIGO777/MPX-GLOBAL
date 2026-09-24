import { attachmentView } from './conversation.view.js';

/**
 * Step 1b · support ticket projections.
 *
 * 🔴 TWO audiences, two shapes — never one object with fields hidden by the
 * client:
 *   - COMPANY: its own ticket. No `assignedTo`, no employee name, no author id.
 *     Staff messages are "MPX Global Support" (authorType `staff`), exactly as a
 *     block reason is shown to a party without `blockedBy`.
 *   - STAFF: the queue. Company, creator, assignee and each author's name.
 */

export function companyTicketView(t) {
  return {
    id: String(t._id),
    ref: t.ref,
    subject: t.subject,
    category: t.category,
    status: t.status,
    unread: Boolean(t.unread?.company),
    lastMessageAt: t.lastMessageAt,
    createdAt: t.createdAt,
    resolvedAt: t.resolvedAt ?? null,
    closedBy: t.closedBy ?? null, // 'staff' | 'company' | 'auto' | null
    autoClosedAfterDays: t.autoClosedAfterDays ?? null,
    followUpOf: t.followUpOf ? { id: String(t.followUpOf), ref: t.followUpRef } : null,
  };
}

export function companyMessageView(m) {
  return {
    id: String(m._id),
    authorType: m.authorType, // 'company' (this account) | 'staff' (MPX Global Support)
    body: m.body ?? '',
    attachment: attachmentView(m.attachment),
    createdAt: m.createdAt,
  };
}

/**
 * @param names Map<string, {name, email?}> of user ids → display data
 * @param orgs  Map<string, {name, slug?}>
 */
export function staffTicketView(t, { names = new Map(), orgs = new Map(), autoCloseDays = null } = {}) {
  const org = orgs.get(String(t.orgId));
  const creator = names.get(String(t.createdBy));
  const assignee = t.assignedTo ? names.get(String(t.assignedTo)) : null;
  return {
    id: String(t._id),
    ref: t.ref,
    subject: t.subject,
    category: t.category,
    status: t.status,
    side: t.side,
    org: { id: String(t.orgId), name: org?.name ?? '—' },
    createdBy: { id: String(t.createdBy), name: creator?.name ?? '—', email: creator?.email ?? null },
    assignedTo: t.assignedTo ? { id: String(t.assignedTo), name: assignee?.name ?? '—' } : null,
    unread: Boolean(t.unread?.staff),
    lastMessageAt: t.lastMessageAt,
    createdAt: t.createdAt,
    resolvedAt: t.resolvedAt ?? null,
    closedBy: t.closedBy ?? null,
    awaitingCompanySince: t.awaitingCompanySince ?? null,
    // When it will close itself, computed HERE from the setting in force so no
    // screen carries its own copy of the day count (2026-09-25).
    autoCloseAt:
      t.status !== 'resolved' && t.awaitingCompanySince && autoCloseDays
        ? new Date(new Date(t.awaitingCompanySince).getTime() + autoCloseDays * 86_400_000)
        : null,
    autoClosedAfterDays: t.autoClosedAfterDays ?? null,
    followUpOf: t.followUpOf ? { id: String(t.followUpOf), ref: t.followUpRef } : null,
  };
}

export function staffMessageView(m, names = new Map()) {
  return {
    id: String(m._id),
    authorType: m.authorType,
    author: { id: String(m.authorId), name: names.get(String(m.authorId))?.name ?? '—' },
    body: m.body ?? '',
    attachment: attachmentView(m.attachment),
    createdAt: m.createdAt,
  };
}
