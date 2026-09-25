import { apiClient } from './client.js';

/**
 * Module 4 — quotations, the app's half (2026-09-25).
 *
 * 🔴 READ AND ANSWER ONLY. Building and sending a quotation is web-only by
 * design: it is a long priced form with a bank-details confirmation, and the
 * exporter does that at a desk. What the app carries is the half a person needs
 * on a phone — see the document's figure, counter it, accept it.
 *
 * 🔴 Money crosses the wire as INTEGER MINOR UNITS, exactly as on the web. The
 * conversion happens once, at the edge (`toMinor` in the card), never inline in
 * a handler where the next caller forgets.
 *
 * 🔴 Accepting is TWO calls and there is no single-shot accept on the server —
 * a code goes to the person's own registered email and proves it. It is a
 * CONFIRMED ACCEPTANCE, not a digital signature; no copy anywhere may call it
 * one (see `OTP_PURPOSE` in the backend's enums.js).
 */
/**
 * The exporter's saved bank details — what a quotation PRINTS.
 *
 * 🔴 DISPLAY-ONLY (C1): these are shown on a document the buyer pays against
 * directly. No payout path may ever read them, and the platform never touches
 * that money. The server stores the number ENCRYPTED and never returns it —
 * every response carries `masked` (`••••4444`) only.
 */
export const bankAccountsApi = {
  list: () => apiClient.get('/me/bank-accounts').then((r) => r.data.bankAccounts),
  create: (body) => apiClient.post('/me/bank-accounts', body).then((r) => r.data.bankAccount),
  update: (id, patch) => apiClient.patch(`/me/bank-accounts/${id}`, patch).then((r) => r.data.bankAccount),
  remove: (id) => apiClient.delete(`/me/bank-accounts/${id}`).then((r) => r.data),
};

export const quotationsApi = {
  get: (id) => apiClient.get(`/quotations/${id}`).then((r) => r.data.quotation),

  forConversation: (conversationId) =>
    apiClient.get(`/conversations/${conversationId}/quotations`).then((r) => r.data.quotations),

  /** A counter-offer — the whole deal's figure. The quotation stays LIVE. */
  negotiate: (id, { totalMinor, note }) =>
    apiClient
      .post(`/quotations/${id}/negotiate`, { totalMinor, ...(note ? { note } : {}) })
      .then((r) => r.data.quotation),

  requestAcceptCode: (id) => apiClient.post(`/quotations/${id}/accept/request-code`, {}).then((r) => r.data),

  confirmAccept: (id, code) =>
    apiClient.post(`/quotations/${id}/accept/confirm`, { code }).then((r) => r.data.quotation),
};
