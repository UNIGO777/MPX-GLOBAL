import { apiClient } from './client.js';

/**
 * FINALIZE F5 — the error log viewer (`errorlog:read`).
 *
 * Read-only by design: the backend has NO write verb here — no delete, no
 * "clear log", no export — and this module must never grow one. Retention is a
 * 90-day TTL on the server, not a staff action.
 *
 * List row: { id, occurredAt, statusCode, method, route, requestId, message,
 *             user: {id,name,role}|null, orgId|null }
 * Detail:   the row plus { stack, recordedAt }.
 *
 * 🔴 Content is INTERNAL — stack traces and internal messages. Nothing from
 * these calls may be rendered outside the admin panel.
 */
export const errorLogApi = {
  list: (params) => apiClient.get('/admin/errors', { params }).then((r) => r.data),
  entry: (id) => apiClient.get(`/admin/errors/${id}`).then((r) => r.data.entry),
};

export const errorLogKeys = {
  list: (params) => ['admin', 'errors', params],
  entry: (id) => ['admin', 'errors', 'entry', id],
};
