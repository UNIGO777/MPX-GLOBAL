import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Fast2SMS transactional SMS transport.
 *
 * 🔴 SECURITY (auth-sessions A3, security-baseline #4): this module handles OTP
 * codes. It must never log one, never put one in an error message, and never
 * return one to a caller. Only the provider's request id and status are logged.
 *
 * 🔴 INDIA ONLY. Fast2SMS accepts 10-digit Indian MSISDNs. `canDeliverTo()` is
 * the guard callers use BEFORE choosing this transport — do not "improve" it by
 * stripping the country code off an arbitrary number and hoping, because that
 * silently posts an international user's number as if it were Indian and the
 * code is never delivered.
 *
 * Uses global fetch (Node >= 18) — no new dependency.
 */

const FAST2SMS_ENDPOINT = 'https://www.fast2sms.com/dev/bulkV2';
const REQUEST_TIMEOUT_MS = 10_000;

export function isSmsConfigured() {
  return Boolean(env.FAST2SMS_API_KEY);
}

/**
 * Fast2SMS reaches Indian numbers only.
 * @param {string} e164 e.g. "+919876543210"
 * @returns {boolean}
 */
export function canDeliverTo(e164) {
  return /^\+91\d{10}$/.test(String(e164 ?? ''));
}

/** Fast2SMS wants the bare 10-digit subscriber number, not E.164. */
function toIndianSubscriberNumber(e164) {
  const match = /^\+91(\d{10})$/.exec(String(e164 ?? ''));
  if (!match) throw new Error('fast2sms: not an Indian mobile number');
  return match[1];
}

/**
 * Sends one transactional SMS.
 *
 * @param {{ to: string, variables: string[] }} params
 *   `to` is E.164; `variables` fill the DLT template's placeholders in order.
 * @returns {Promise<{ requestId: string|null }>}
 * @throws when the gateway rejects the message — the caller must surface a
 *   failure rather than leave a user waiting for a code that was never sent.
 */
export async function sendSms({ to, variables }) {
  if (!isSmsConfigured()) throw new Error('fast2sms: FAST2SMS_API_KEY is not configured');

  const numbers = toIndianSubscriberNumber(to);

  // 🔴 `route=otp`, NOT `route=dlt` — established against the live gateway
  // (2026-08-04). The DLT route answers **"Invalid Sender ID"** on this account
  // because it additionally requires an approved `sender_id`, which we do not
  // have. The OTP route uses Fast2SMS's own approved OTP template, needs no
  // sender id and no template id, and is DND-exempt — which matters, because a
  // login code blocked by DND is a locked-out user.
  //
  // Consequence: the message body is Fast2SMS's fixed template, so we cannot put
  // the expiry in the SMS. Only the code is sent; the EMAIL template still
  // states the expiry. If you later get a DLT sender id approved, switch to
  // `route: 'dlt'` with `message: env.FAST2SMS_OTP_ID` + a `sender_id`.
  const body = new URLSearchParams({
    route: 'otp',
    variables_values: variables[0],
    numbers,
  });

  // AbortSignal.timeout so a hung gateway cannot hold an auth request open.
  let response;
  try {
    response = await fetch(FAST2SMS_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: env.FAST2SMS_API_KEY,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    // Deliberate: a fetch error can carry the request init, and our request body
    // contains the OTP. Attaching `cause` would put the code on the error chain,
    // where a crash reporter or a `cause`-walking log would surface it (A3). The
    // diagnostic value is preserved by logging the reason here instead.
    logger.error({ reason: cause?.name ?? 'error' }, 'fast2sms: request failed');
    // eslint-disable-next-line preserve-caught-error -- see above: `cause` would carry the OTP
    throw new Error('fast2sms: request failed');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.return !== true) {
    // Log the provider's own message (a rejection reason such as "Invalid
    // Template" — it does not echo our variables) plus the status. Never the body.
    logger.error(
      { status: response.status, providerMessage: payload?.message ?? null },
      'fast2sms: send rejected',
    );
    throw new Error('fast2sms: gateway rejected the message');
  }

  const requestId = payload?.request_id ?? null;
  logger.info({ requestId }, 'fast2sms: message accepted');
  return { requestId };
}
