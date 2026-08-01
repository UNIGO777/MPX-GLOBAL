/**
 * FINALIZE F5 — error log projections.
 *
 * The stack is on the DETAIL only. Not for secrecy — anyone who can open the list
 * can open a row — but because a stack is thousands of characters and a 50-row
 * page carrying fifty of them is a response no console should have to load.
 *
 * Secrets are handled at the WRITE site (`persistErrorLog` → `redactSecrets`),
 * not here. This view deliberately does not re-filter: a redaction applied on
 * read would still leave the live credential sitting in the collection, in every
 * backup and in every `mongodump`. The guarantee only means something upstream.
 */

/** List row — enough to scan a page and pick the entry worth opening. */
export function errorListView(entry, user) {
  return {
    id: String(entry._id),
    occurredAt: entry.occurredAt ?? entry.createdAt ?? null,
    statusCode: entry.statusCode,
    method: entry.method ?? null,
    route: entry.route ?? null,
    // The identifier the reporting user actually has in their hands.
    requestId: entry.requestId ?? null,
    message: entry.message ?? null,
    user,
    orgId: entry.orgId ? String(entry.orgId) : null,
  };
}

/** Detail — the list row plus the stack. */
export function errorDetailView(entry, user) {
  return {
    ...errorListView(entry, user),
    stack: entry.stack ?? null,
    recordedAt: entry.createdAt ?? null,
  };
}
