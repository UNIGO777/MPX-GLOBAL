import { apiClient } from './client.js';

/**
 * M4 — enquiry threads. The party surface (buyer + seller) and the staff
 * moderation surface, which are DIFFERENT endpoints with different payloads and
 * must never be confused for one another.
 *
 * Party shapes (backend `views/conversation.view.js`):
 *   GET  /conversations?q&cursor&limit    → { conversations[], nextCursor }
 *   GET  /conversations/unread-count      → { unread }              ← THREADS, not messages
 *   GET  /conversations/by-product/:id    → { conversationId }      ← 404 = no thread yet
 *   GET  /conversations/:id               → { conversation }
 *   GET  /conversations/:id/messages      → { messages[], nextBefore }   oldest-first
 *   POST /conversations/:id/messages      → { message }             ← 60/min
 *   POST /conversations/:id/read          → { readAt }
 *
 *   conversation = { id, title, product{id,slug,name}, counterparty{name},
 *                    participants[3], lastMessageAt, lastMessagePreview, unread,
 *                    frozen, frozenLabel{tone,text}, blockedReason, createdAt }
 *   message      = { id, senderType, body, createdAt }
 *
 * 🔒 What is deliberately NOT here, because the server never sends it:
 *   - a person's name or user id. `senderType` (buyer|exporter|system) is the
 *     whole attribution — M4-17 threads name COMPANIES, never people.
 *   - `blockedBy` / `blockedAt`. Parties see the block REASON (M4-25); who wrote
 *     it is staff-only, exactly as a seller never sees `takedown.byUserId`.
 *   - a per-thread unread COUNT. `unread` is a boolean and the badge counts
 *     threads. No number exists server-side, so none may be invented here.
 *   - a `verified` flag on the counterparty. Not in the conversation projection;
 *     the tick belongs to the public product/seller surface.
 *
 * ⚠️ Search matches NAMES and org ids only, never message content (M4-32). It
 * tries whole-word `$text` first and falls back to a word-prefix match, so
 * "Tex" finds "Textiles" but "ileHub" finds nothing.
 */
export const conversationsApi = {
  list: (params = {}) => apiClient.get('/conversations', { params }).then((r) => r.data),
  unreadCount: () => apiClient.get('/conversations/unread-count').then((r) => r.data.unread),
  detail: (id) => apiClient.get(`/conversations/${id}`).then((r) => r.data.conversation),
  messages: (id, params = {}) =>
    apiClient.get(`/conversations/${id}/messages`, { params }).then((r) => r.data),
  send: (id, body) =>
    apiClient.post(`/conversations/${id}/messages`, { body }).then((r) => r.data.message),
  markRead: (id) => apiClient.post(`/conversations/${id}/read`).then((r) => r.data),

  /**
   * The product page's button state ("Create enquiry" vs "Open chat").
   *
   * A 404 is the ANSWER, not an error — it means this buyer has no thread on
   * this product yet. Resolved to `null` here so callers never have to inspect a
   * status code, and so a real failure (500, offline) still throws.
   */
  findByProduct: async (productId) => {
    try {
      const { data } = await apiClient.get(`/conversations/by-product/${productId}`);
      return data.conversationId;
    } catch (err) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },
};

/**
 * Staff moderation. Access is by PERMISSION, never membership — and every read
 * of a thread or its messages writes an AuditLog row on the server (M4-34),
 * which is why the list and the detail are separate calls: browsing the list is
 * free, opening a conversation is recorded.
 *
 * The staff payload adds `buyerOrg{id,name}`, `exporterOrg{id,name}`,
 * `frozenReason`, `blockedBy`, `blockedAt`, and `unread{buyer,exporter}` — the
 * two parties' unread, never the moderator's own.
 *
 * There is NO send endpoint here at any permission level: admin can read, admin
 * cannot speak.
 */
export const adminConversationsApi = {
  list: (params = {}) => apiClient.get('/admin/conversations', { params }).then((r) => r.data),
  detail: (id) => apiClient.get(`/admin/conversations/${id}`).then((r) => r.data.conversation),
  messages: (id, params = {}) =>
    apiClient.get(`/admin/conversations/${id}/messages`, { params }).then((r) => r.data),
  block: (id, reason) =>
    apiClient.post(`/admin/conversations/${id}/block`, { reason }).then((r) => r.data.conversation),
  // The reason is optional and audit-only — parties never see it (unlike block).
  unblock: (id, reason) =>
    apiClient
      .post(`/admin/conversations/${id}/unblock`, reason ? { reason } : {})
      .then((r) => r.data.conversation),
};

export const conversationKeys = {
  all: ['conversations'],
  /**
   * ⚠️ The search term is NORMALISED into the key. The dock passes nothing for
   * "no search" and the inbox page passes an empty string — as raw values those
   * are two different cache entries, so the same list was fetched and stored
   * twice, and reading a thread in one surface left the other showing it unread.
   */
  /**
   * The PREFIX behind every list variant. A patch or an invalidation has to
   * reach all of them — `list()` carries the params object, so matching on it
   * would hit only the unsearched cache entry and leave a filtered list stale.
   */
  lists: () => ['conversations', 'list'],
  list: (params = {}) => ['conversations', 'list', { q: params.q || null }],
  detail: (id) => ['conversations', 'detail', id],
  messages: (id) => ['conversations', 'messages', id],
  unread: () => ['conversations', 'unread'],
  byProduct: (productId) => ['conversations', 'by-product', productId],
  admin: {
    all: ['admin-conversations'],
    list: (params) => ['admin-conversations', 'list', params],
    detail: (id) => ['admin-conversations', 'detail', id],
    messages: (id) => ['admin-conversations', 'messages', id],
  },
};
