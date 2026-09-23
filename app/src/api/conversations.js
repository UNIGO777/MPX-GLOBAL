import { apiClient } from './client.js';

/**
 * M4 — enquiry & chat, REST layer (2026-08-20). The socket is LIVE DELIVERY
 * ONLY (§7.1): everything that matters — list, history, send, mark-read —
 * works over these calls even with the socket down.
 *
 * Server shapes (`conversation.view.js`, whitelists):
 *   list     → { conversations: [partyView], nextCursor }
 *   get      → { conversation: partyView }
 *   messages → { messages: [messageView], nextBefore }   newest-first
 *   send     → 201 { message: messageView }
 *   partyView: { id, title, product{id,slug,name}, counterparty{name,logo},
 *                participants, lastMessageAt, lastMessagePreview, unread,
 *                frozen, frozenLabel{tone,text}, blockedReason, createdAt }
 *   messageView: { id, senderType: 'buyer'|'exporter'|'system', systemKind,
 *                  body, attachment, createdAt } — company-level only, never a person.
 *   attachment: null | { kind:'image', url, width, height }
 *                    | { kind:'document', url, viewUrl, name, format, bytes }
 *     `viewUrl` — PDFs only: an INLINE link that opens instead of downloading.
 *     `url` is a SHORT-LIVED signed link (10 min), minted per read.
 *
 * 🔴 `blockedReason` is the reason BOTH parties may see (M4-25); the acting
 * admin is never serialised. Do not add fields client-side that the view
 * withholds.
 */
function sendFile(id, field, { body, file }) {
  const form = new FormData();
  form.append(field, { uri: file.uri, name: file.name, type: file.mimeType });
  form.append('body', body);
  return apiClient
    .post(`/conversations/${id}/messages/${field}`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data.message);
}

export const conversationsApi = {
  /** q searches the three denormalised names; cursor-paginated. */
  list: (params = {}) => apiClient.get('/conversations', { params }).then((r) => r.data),

  get: (id) => apiClient.get(`/conversations/${id}`).then((r) => r.data.conversation),

  /**
   * 🔴 The SERVER returns messages OLDEST-FIRST — it reverses the page before
   * responding (`conversation.service.js`: "Oldest-first: the client appends
   * upward when scrolling back"). The app's thread is an INVERTED list, which
   * renders index 0 at the BOTTOM and therefore wants NEWEST-first; feeding it
   * the server's order rendered every thread upside-down (owner-reported
   * 2026-08-20: the 13:03 welcome sat below 13:25 messages).
   *
   * Normalised HERE, at the transport boundary, so exactly one place knows the
   * wire order and every consumer gets the same shape. `nextBefore` is
   * unaffected — the server computes it from the page's oldest row either way.
   */
  messages: (id, params = {}) =>
    apiClient.get(`/conversations/${id}/messages`, { params }).then((r) => ({
      ...r.data,
      messages: [...(r.data.messages ?? [])].reverse(),
    })),

  /** REST send BROADCASTS server-side (§0.1) — the sender also receives the
   *  same message over the socket, so callers must de-duplicate by `id`. */
  send: (id, body) => apiClient.post(`/conversations/${id}/messages`, { body }).then((r) => r.data.message),

  /**
   * D9 · an image, D10 · a document (PDF / .docx / .xlsx) — each its own
   * multipart route, same guards as `send`. `body` travels but may be EMPTY —
   * a file can go on its own since 2026-09-24 (owner). The server sniffs the
   * real bytes; nothing here is trusted. React Native's FormData takes the
   * {uri, name, type} shape, not a Blob.
   */
  sendImage: (id, { body, file }) => sendFile(id, 'image', { body, file }),
  sendDocument: (id, { body, file }) => sendFile(id, 'document', { body, file }),

  markRead: (id) => apiClient.post(`/conversations/${id}/read`).then((r) => r.data),

  /** Unread THREADS for the badge — derived server-side, never stored. */
  unreadCount: () => apiClient.get('/conversations/unread-count').then((r) => r.data.unread),
};
