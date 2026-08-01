import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * M4-H — the thin FCM wrapper. The rest of the code never imports firebase-admin
 * directly: one place to mock in tests, one place to change transport.
 *
 * SECURITY: the service account lives ONLY in env and never leaves the server.
 * It must not appear in a response, a log line or an error message.
 *
 * If it is absent the whole layer is INERT — `isPushConfigured()` is false and
 * every send is a no-op. The same posture as `ai.client.js`: a feature the owner
 * has not configured yet must never crash a request path.
 */

let messaging = null;
let initialised = false;

export function isPushConfigured() {
  return Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON);
}

async function getMessaging() {
  if (initialised) return messaging;
  initialised = true;

  if (!isPushConfigured()) return null;
  try {
    const admin = (await import('firebase-admin')).default;
    const credentials = JSON.parse(
      Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf8'),
    );
    const app = admin.apps?.length
      ? admin.app()
      : admin.initializeApp({ credential: admin.credential.cert(credentials) });
    messaging = admin.messaging(app);
  } catch (err) {
    // Log the SHAPE only — never the credential, and never the parsed JSON.
    logger.error(
      { err: { name: err?.name, message: err?.message } },
      'firebase init failed — push disabled for this process',
    );
    messaging = null;
  }
  return messaging;
}

// FCM's way of saying "this device is gone". The token must be deleted, or the
// row lingers forever and every future send wastes a call on it.
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Send one notification to many tokens.
 * Returns the tokens FCM reported as dead so the caller can delete them.
 * Never throws — a push problem must not surface in a user-facing request.
 */
export async function sendToTokens({ tokens, title, body, data }) {
  // Check for an empty recipient list BEFORE touching Firebase: initialising the
  // SDK to then send to nobody is pure waste, and it happens on most requests —
  // the common case is a counterparty with no device registered at all.
  if (tokens.length === 0) return { sent: 0, deadTokens: [] };

  const client = await getMessaging();
  if (!client) return { sent: 0, deadTokens: [] };

  try {
    const res = await client.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: data ?? {},
    });

    const deadTokens = [];
    res.responses?.forEach((r, i) => {
      if (!r.success && DEAD_TOKEN_CODES.has(r.error?.code)) deadTokens.push(tokens[i]);
    });

    return { sent: res.successCount ?? 0, deadTokens };
  } catch (err) {
    logger.warn({ err: { name: err?.name, message: err?.message } }, 'push send failed');
    return { sent: 0, deadTokens: [] };
  }
}
