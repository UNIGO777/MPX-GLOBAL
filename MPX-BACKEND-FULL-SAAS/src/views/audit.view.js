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

/**
 * List row — timestamp · actor · action · target (m5 §6).
 *
 * `target.name` is resolved by the service: the entity's CURRENT name where the
 * row still exists, else the name the entry snapshotted, else null. It is
 * genuinely nullable — most actions never recorded a name (a takedown stores its
 * reason, a publish stores its status), so a target that has since been deleted
 * may have none. The screen renders "—" there rather than pretending.
 */
export function auditListView(entry, actor, targetName = null) {
  return {
    id: String(entry._id),
    occurredAt: entry.occurredAt ?? entry.createdAt ?? null,
    actor,
    action: entry.action,
    target: {
      type: entry.entityType ?? null,
      id: entry.entityId ? String(entry.entityId) : null,
      name: targetName ?? null,
    },
    // The admin's own words, where the action had any — a takedown reason, a
    // rejection reason, an org-block reason. Nullable: most actions carry none.
    // Safe to surface at list level because m5-rules §4 forbids KYC values,
    // tokens, OTPs, bodies or contact details from ever entering an audit row;
    // the guarantee lives at the WRITE site, which is the only place it can be
    // complete.
    reason: entry.after?.reason ?? entry.before?.reason ?? null,
    orgId: entry.orgId ? String(entry.orgId) : null,
  };
}

/** Detail — the whole entry. */
export function auditDetailView(entry, actor, targetName = null) {
  return {
    ...auditListView(entry, actor, targetName),
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
