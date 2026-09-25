import { apiClient } from './client.js';

/**
 * B8 · the web notification centre (owner override 2026-09-25).
 *
 *   GET  /notifications?before=&unread=1   → { items[], nextBefore }
 *   GET  /notifications/unread-count       → { unread }
 *   POST /notifications/:id/read           → { ok }
 *   POST /notifications/read-all           → { updated }
 *
 * item: { id, type, title, body, link, count, at, read }. Always the caller's
 * OWN — the server takes the user from the token, never from here.
 */
export const notificationsApi = {
  list: (params = {}) => apiClient.get('/notifications', { params }).then((r) => r.data),
  unreadCount: () => apiClient.get('/notifications/unread-count').then((r) => r.data.unread),
  markRead: (id) => apiClient.post(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => apiClient.post('/notifications/read-all').then((r) => r.data),
};

export const notificationKeys = {
  all: ['notifications'],
  unread: ['notifications', 'unread'],
  list: (params) => ['notifications', 'list', params ?? {}],
};
