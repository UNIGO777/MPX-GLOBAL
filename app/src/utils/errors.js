/**
 * Turns an axios/network failure into something a screen can render.
 *
 * Two rules the backend already follows and the app must not undo:
 *  - The server returns a generic message plus a request id; it never leaks a
 *    Mongo error, a stack or a collection name. Show the server's message when
 *    there is one, and never invent detail it withheld.
 *  - "Wrong password" and "unknown account" are the same answer by design.
 *    Never branch the UI on a guess about which one it was.
 */

import { logger } from './logger.js';

export const ERROR_KIND = {
  offline: 'offline',
  timeout: 'timeout',
  auth: 'auth',
  validation: 'validation',
  rateLimited: 'rateLimited',
  server: 'server',
  unknown: 'unknown',
};

const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';

function kindForStatus(status) {
  if (status === 401 || status === 403) return ERROR_KIND.auth;
  if (status === 400 || status === 422) return ERROR_KIND.validation;
  if (status === 429) return ERROR_KIND.rateLimited;
  if (status >= 500) return ERROR_KIND.server;
  return ERROR_KIND.unknown;
}

/**
 * @returns {{ kind: string, message: string, status: number|null, requestId: string|null, retryable: boolean }}
 */
export function toAppError(error) {
  // No response at all — the request never reached us. Distinguish a dropped
  // network from a slow one so the screen can offer the right action instead of
  // spinning forever (auth-app-steps Step 3.6).
  if (error?.response == null) {
    const isTimeout = error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT';

    // Dev-only diagnostic. "You're offline" is otherwise undiagnosable: it is
    // what the user sees for a DNS failure, a refused connection, a TLS
    // rejection and a blocked-by-policy request alike. The underlying code and
    // the URL are exactly what separates them, and both are non-sensitive —
    // `logger` strips tokens anyway, and it compiles out of release builds.
    logger.debug('request failed with no response', {
      code: error?.code ?? null,
      reason: error?.message ?? null,
      url: error?.config?.url ?? null,
      baseURL: error?.config?.baseURL ?? null,
    });

    return {
      kind: isTimeout ? ERROR_KIND.timeout : ERROR_KIND.offline,
      message: isTimeout
        ? 'The request took too long. Check your connection and try again.'
        : "You're offline. Check your connection and try again.",
      status: null,
      requestId: null,
      retryable: true,
    };
  }

  const { status, data } = error.response;

  // The central error handler answers `{ error: { message, requestId } }` —
  // the envelope is nested, so `data.message` is always undefined.
  // (MPX-BACKEND-FULL-SAAS/src/middleware/errorHandler.js)
  const envelope = data?.error ?? {};
  const serverMessage = typeof envelope.message === 'string' ? envelope.message : null;

  // 🆕 2026-08-19 — validation 400s carry `fields: [{field, message}]` and the
  // app was DROPPING it, so every schema rejection surfaced as the bare
  // "Invalid request." with no clue which field was wrong (it cost a real
  // debugging round on the product form). These are the caller's own inputs,
  // so they are safe to show — the server sends them for exactly this reason.
  // Field paths arrive prefixed by request part ("body.countryOfOrigin");
  // strip that, it means nothing to a user.
  const fields = Array.isArray(envelope.fields) ? envelope.fields : null;
  const fieldDetail =
    fields && fields.length > 0
      ? fields
          .slice(0, 3)
          .map((f) => `${String(f.field ?? '').replace(/^(body|query|params)\./, '')}: ${f.message}`)
          .join('\n')
      : null;

  return {
    kind: kindForStatus(status),
    message: fieldDetail ? `${serverMessage ?? DEFAULT_MESSAGE}\n\n${fieldDetail}` : (serverMessage ?? DEFAULT_MESSAGE),
    fields,
    status,
    // Surfaced so a user can quote it in a support ticket; it identifies a
    // server-side log entry and carries no data of its own.
    requestId: typeof envelope.requestId === 'string' ? envelope.requestId : null,
    retryable: status >= 500 || status === 429,
  };
}
