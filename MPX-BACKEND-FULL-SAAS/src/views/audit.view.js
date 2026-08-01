/**
 * M5-C — audit entry projections.
 *
 * The list is a summary; the detail carries the whole entry, including the
 * before/after snapshot. That is safe to expose to `audit:read` because the
 * snapshots are already written redacted — `m5-rules §4` forbids putting KYC
 * values, tokens, passwords, OTPs, full request bodies or seller contact details
 * into an audit row in the first place. This view does not re-filter them; the
 * guarantee lives at the write site, which is the only place it can be complete.
 */

/** List row — timestamp · actor · action · target (m5 §6). */
export function auditListView(entry, actor) {
  return {
    id: String(entry._id),
    occurredAt: entry.occurredAt ?? entry.createdAt ?? null,
    actor,
    action: entry.action,
    target: {
      type: entry.entityType ?? null,
      id: entry.entityId ? String(entry.entityId) : null,
    },
    orgId: entry.orgId ? String(entry.orgId) : null,
  };
}

/** Detail — the whole entry. */
export function auditDetailView(entry, actor) {
  return {
    ...auditListView(entry, actor),
    before: entry.before ?? null,
    after: entry.after ?? null,
    // Request context, useful when reconstructing what happened. `requestId`
    // ties the row back to the server logs for the same call.
    requestId: entry.requestId ?? null,
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
    recordedAt: entry.createdAt ?? null,
  };
}
