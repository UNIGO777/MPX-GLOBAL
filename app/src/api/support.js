import { apiClient } from './client.js';

/**
 * Step 1 · Help & support. `contact()` is public (no auth): the server returns
 * the support email + phone only.
 *
 * Tickets (Step 1b) are scoped server-side to this account's company AND side
 * (404 otherwise). A message may carry ONE file (image, or PDF/.docx/.xlsx) —
 * multipart field `file`, the server sniffs the real bytes.
 */
function send(path, fields, file) {
  if (!file) return apiClient.post(path, fields).then((r) => r.data);
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v ?? '');
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType });
  return apiClient
    .post(path, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
}

export const supportApi = {
  contact: () => apiClient.get('/public/support-contact').then((r) => r.data.support),
  myTickets: (params = {}) => apiClient.get('/support/tickets', { params }).then((r) => r.data),
  myTicket: (id) => apiClient.get(`/support/tickets/${id}`).then((r) => r.data),
  create: ({ subject, category, body, file, followUpOf }) =>
    send('/support/tickets', { subject, category, body, ...(followUpOf ? { followUpOf } : {}) }, file),
  close: (id) => apiClient.post(`/support/tickets/${id}/close`).then((r) => r.data),
  reply: (id, { body, file }) => send(`/support/tickets/${id}/messages`, { body }, file),
};

export const TICKET_CATEGORIES = [
  { value: 'account', label: 'Account & sign-in', icon: 'person-outline' },
  { value: 'verification', label: 'Verification', icon: 'shield-checkmark-outline' },
  { value: 'products', label: 'Products & listings', icon: 'cube-outline' },
  { value: 'enquiries', label: 'Enquiries & chat', icon: 'chatbubbles-outline' },
  { value: 'technical', label: 'Something is broken', icon: 'warning-outline' },
  { value: 'other', label: 'Something else', icon: 'help-buoy-outline' },
];
export const CATEGORY_LABEL = Object.fromEntries(TICKET_CATEGORIES.map((c) => [c.value, c.label]));
export const TICKET_STATUS = {
  open: { label: 'Open', tone: 'warning' },
  in_progress: { label: 'In progress', tone: 'info' },
  resolved: { label: 'Resolved', tone: 'success' },
};

/** Step 1d · "find me a supplier" requests (buyer accounts). */
export const leadsApi = {
  mine: () => apiClient.get('/leads').then((r) => r.data.leads),
  create: (body) => apiClient.post('/leads', body).then((r) => r.data.lead),
};
export const LEAD_STATUS = {
  new: { label: 'New', tone: 'warning' },
  in_progress: { label: 'Finding suppliers', tone: 'info' },
  routed: { label: 'Suppliers connected', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
};
