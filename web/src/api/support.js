import { apiClient } from './client.js';

/**
 * Step 1 · Help & support.
 *
 * `contact()` is PUBLIC (no auth) — the server returns the support email and
 * phone only; everything else in platform settings stays superadmin-side.
 *
 * Tickets (Step 1b): the company calls are scoped server-side to the caller's
 * own company AND side; the staff calls need `support:manage`. A message may
 * carry ONE file (image or PDF/.docx/.xlsx) — sent as multipart field `file`.
 */
function withFile(fields, file) {
  if (!file) return fields;
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v ?? '');
  form.append('file', file);
  return form;
}

export const supportApi = {
  // → { support: { email, phone, hours }, company: { name, address, linkedinUrl } }
  contact: () => apiClient.get('/public/support-contact').then((r) => r.data),

  // ── company ──
  myTickets: (params) => apiClient.get('/support/tickets', { params }).then((r) => r.data),
  myTicket: (id) => apiClient.get(`/support/tickets/${id}`).then((r) => r.data),
  myUnread: () => apiClient.get('/support/tickets/unread-count').then((r) => r.data.count),
  create: ({ subject, category, body, file, followUpOf }) =>
    apiClient
      .post('/support/tickets', withFile({ subject, category, body, ...(followUpOf ? { followUpOf } : {}) }, file))
      .then((r) => r.data),
  close: (id) => apiClient.post(`/support/tickets/${id}/close`).then((r) => r.data),
  reply: (id, { body, file }) =>
    apiClient.post(`/support/tickets/${id}/messages`, withFile({ body }, file)).then((r) => r.data),

  // ── staff ──
  queue: (params) => apiClient.get('/admin/support/tickets', { params }).then((r) => r.data),
  ticket: (id) => apiClient.get(`/admin/support/tickets/${id}`).then((r) => r.data),
  timeline: (id) => apiClient.get(`/admin/support/tickets/${id}/timeline`).then((r) => r.data.events),
  staffReply: (id, { body, file }) =>
    apiClient.post(`/admin/support/tickets/${id}/messages`, withFile({ body }, file)).then((r) => r.data),
  setStatus: (id, status) => apiClient.patch(`/admin/support/tickets/${id}/status`, { status }).then((r) => r.data),
  assign: (id, assigneeId) => apiClient.patch(`/admin/support/tickets/${id}/assign`, { assigneeId }).then((r) => r.data),
  assignees: () => apiClient.get('/admin/support/assignees').then((r) => r.data.staff),
  overview: () => apiClient.get('/admin/support/overview').then((r) => r.data),
  log: (params) => apiClient.get('/admin/support/log', { params }).then((r) => r.data),
};

export const supportKeys = {
  contact: ['public', 'support-contact'],
  mine: (params) => ['support', 'mine', params ?? {}],
  mineAll: ['support', 'mine'],
  myTicket: (id) => ['support', 'ticket', id],
  myUnread: ['support', 'unread'],
  queue: (params) => ['admin', 'support', 'queue', params ?? {}],
  staffAll: ['admin', 'support'],
  ticket: (id) => ['admin', 'support', 'ticket', id],
  timeline: (id) => ['admin', 'support', 'timeline', id],
  assignees: ['admin', 'support', 'assignees'],
  overview: ['admin', 'support', 'overview'],
  log: (params) => ['admin', 'support', 'log', params ?? {}],
};

/** Step 1c · staff-only internal notes on an organisation / conversation / ticket. */
export const notesApi = {
  list: (subjectType, subjectId) =>
    apiClient.get('/admin/notes', { params: { subjectType, subjectId } }).then((r) => r.data.notes),
  add: (subjectType, subjectId, body) =>
    apiClient.post('/admin/notes', { subjectType, subjectId, body }).then((r) => r.data.note),
};
export const notesKeys = { list: (type, id) => ['admin', 'notes', type, id] };

/** Step 1d · "find me a supplier" requests (buyer side + staff `lead:manage`). */
export const leadsApi = {
  mine: () => apiClient.get('/leads').then((r) => r.data.leads),
  create: (body) => apiClient.post('/leads', body).then((r) => r.data.lead),
  queue: (params) => apiClient.get('/admin/leads', { params }).then((r) => r.data),
  get: (id) => apiClient.get(`/admin/leads/${id}`).then((r) => r.data.lead),
  timeline: (id) => apiClient.get(`/admin/leads/${id}/timeline`).then((r) => r.data.events),
  assign: (id, assigneeId) => apiClient.patch(`/admin/leads/${id}/assign`, { assigneeId }).then((r) => r.data.lead),
  setStatus: (id, status) => apiClient.patch(`/admin/leads/${id}/status`, { status }).then((r) => r.data.lead),
  route: (id, productId) => apiClient.post(`/admin/leads/${id}/route`, { productId }).then((r) => r.data.lead),
  assignees: () => apiClient.get('/admin/leads/assignees').then((r) => r.data.staff),
  overview: () => apiClient.get('/admin/leads/overview').then((r) => r.data),
};
export const leadsKeys = {
  mine: ['leads', 'mine'],
  queue: (p) => ['admin', 'leads', 'queue', p ?? {}],
  all: ['admin', 'leads'],
  one: (id) => ['admin', 'leads', 'one', id],
  timeline: (id) => ['admin', 'leads', 'timeline', id],
  assignees: ['admin', 'leads', 'assignees'],
  overview: ['admin', 'leads', 'overview'],
};

export const LEAD_STATUS = {
  new: { label: 'New', cls: 'bg-warning-50 text-warning-800' },
  in_progress: { label: 'Finding suppliers', cls: 'bg-primary-50 text-primary-700' },
  routed: { label: 'Suppliers connected', cls: 'bg-success-50 text-success-700' },
  closed: { label: 'Closed', cls: 'bg-ink-100 text-ink-600' },
};

/** Step 1e · "My work" + staff reports (any staff; employees see only their own). */
export const reportsApi = {
  myWork: () => apiClient.get('/admin/my-work').then((r) => r.data),
  staff: (params) => apiClient.get('/admin/reports/staff', { params }).then((r) => r.data),
};
export const reportsKeys = {
  myWork: ['admin', 'my-work'],
  staff: (p) => ['admin', 'reports', 'staff', p ?? {}],
};
