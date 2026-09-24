import { apiClient } from './client.js';

/**
 * Module 4 — quotations (month 2).
 *
 * 🔴 Money crosses the wire as INTEGER MINOR UNITS (`rateMinor`, `amountMinor`).
 * Nothing here sends a decimal and nothing sends a total: the server recomputes
 * every figure from the line items, so a stale or tampered client can never move
 * the number the buyer sees. The form converts at the edge, once.
 */
export const quotationKeys = {
  forConversation: (conversationId) => ['quotations', 'conversation', conversationId],
  one: (id) => ['quotations', id],
};

export const quotationsApi = {
  /** Start a draft from a chat thread. Exporter only — the server re-checks. */
  createDraft: (conversationId) =>
    apiClient.post('/quotations', { conversationId }).then((r) => r.data.quotation),

  forConversation: (conversationId) =>
    apiClient.get(`/conversations/${conversationId}/quotations`).then((r) => r.data.quotations),

  get: (id) => apiClient.get(`/quotations/${id}`).then((r) => r.data.quotation),

  update: (id, patch) => apiClient.patch(`/quotations/${id}`, patch).then((r) => r.data.quotation),

  /**
   * Sending FREEZES the document — the bank details, both companies and the
   * totals are snapshotted server-side and can never change afterwards.
   */
  send: (id, bankAccountId) =>
    apiClient.post(`/quotations/${id}/send`, bankAccountId ? { bankAccountId } : {}).then((r) => r.data.quotation),

  /**
   * Draft part of the quotation from a sentence — `target` is `milestones`,
   * `charges` or `details`.
   *
   * 🔴 It RETURNS a suggestion and writes nothing. The rows land in the form and
   * are saved by the ordinary PATCH, after the exporter has read them — the
   * terms and the money on a commercial document are not something an LLM sets.
   *
   * The server reads the incoterm, lead time and currency off the draft itself,
   * so the only thing that travels with this call is the sentence.
   */
  draftWithAi: (id, target, instruction) =>
    apiClient.post(`/quotations/${id}/ai/${target}`, { instruction }).then((r) => r.data),

  /**
   * A counter-offer — the whole deal's figure, in minor units. The quotation
   * stays LIVE: negotiating is not declining.
   */
  negotiate: (id, { totalMinor, note }) =>
    apiClient.post(`/quotations/${id}/negotiate`, { totalMinor, ...(note ? { note } : {}) }).then((r) => r.data.quotation),

  /**
   * Accepting is two calls, and there is no single-shot accept on the server.
   *
   * 🔴 This is a CONFIRMED ACCEPTANCE, not a digital signature (owner,
   * 2026-09-25). The code proves the person's own email; it is not an eSign
   * under the IT Act, and no copy anywhere may call it a signature.
   */
  requestAcceptCode: (id) => apiClient.post(`/quotations/${id}/accept/request-code`, {}).then((r) => r.data),
  confirmAccept: (id, code) =>
    apiClient.post(`/quotations/${id}/accept/confirm`, { code }).then((r) => r.data.quotation),

  decline: (id, reason) =>
    apiClient.post(`/quotations/${id}/decline`, reason ? { reason } : {}).then((r) => r.data.quotation),
};

/** The exporter's saved bank details, for the send step. */
export const bankAccountsApi = {
  list: () => apiClient.get('/me/bank-accounts').then((r) => r.data.bankAccounts),
  create: (body) => apiClient.post('/me/bank-accounts', body).then((r) => r.data.bankAccount),
  update: (id, patch) => apiClient.patch(`/me/bank-accounts/${id}`, patch).then((r) => r.data.bankAccount),
  remove: (id) => apiClient.delete(`/me/bank-accounts/${id}`).then((r) => r.data),
};
