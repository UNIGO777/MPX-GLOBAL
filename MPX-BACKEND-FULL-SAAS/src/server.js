import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { connectDatabase, closeDatabase } from './config/database.js';
import './models/index.js'; // register every model with mongoose
import { schedulePurgeJob } from './jobs/purgeBlockedProducts.js';
import { scheduleTicketAutoCloseJob } from './jobs/ticketAutoClose.js';
import { attachSocket, attachRedisAdapter } from './realtime/socket.js';
import { isCloudinaryConfigured } from './config/cloudinary.js';
import { describeOtpTransports } from './services/otp.sender.js';
import { verifyEmailTransport } from './services/email.provider.js';
import { isFieldCryptoConfigured } from './utils/fieldCrypto.js';

// Connect to MongoDB before accepting traffic — a payments-adjacent service must
// not serve requests without its database.
try {
  await connectDatabase();
} catch (err) {
  logger.fatal({ err: { name: err.name, message: err.message } }, 'could not connect to mongodb; exiting');
  process.exit(1);
}

/**
 * Storage has to be checked at BOOT, not at first upload.
 *
 * Without this the server looks perfectly healthy and the missing configuration
 * only surfaces when a real user is standing in the KYC flow with their PAN card
 * photographed — the worst possible moment to discover a deployment mistake, and
 * one that reads to them as "this app is broken".
 *
 * Production REFUSES to start: KYC upload is a core path, and a production box
 * that cannot store a document should never take traffic. Dev only warns, because
 * most local work never touches the upload path and requiring keys would make the
 * project unclonable.
 */
if (!isCloudinaryConfigured()) {
  if (env.NODE_ENV === 'production') {
    logger.fatal(
      'CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are not set — KYC and image uploads cannot work; exiting',
    );
    process.exit(1);
  }
  logger.warn(
    'Cloudinary is not configured — KYC and image uploads will fail with 503 until CLOUDINARY_* are set in .env',
  );
}

/**
 * Behind a reverse proxy, `TRUST_PROXY` is not optional in practice.
 *
 * Without it Express reports the PROXY's address as `req.ip`, so every visitor
 * shares one rate-limit bucket — the per-IP limits on auth and OTP silently stop
 * limiting anyone, which is the opposite of what B7 is for — and every audit row
 * records nginx instead of the caller. express-rate-limit spots the mismatch and
 * throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR, which is how this surfaced in
 * production rather than as a quiet security hole.
 *
 * A warning, not a hard exit: a deployment with no proxy in front is legitimate,
 * and refusing to boot would be wrong there.
 */
if (env.NODE_ENV === 'production' && env.TRUST_PROXY === undefined) {
  logger.warn(
    'TRUST_PROXY is not set. If anything proxies this server (nginx, a load balancer), req.ip is the PROXY — per-IP rate limits stop working and audit rows record the wrong address. Set TRUST_PROXY=1 for a single hop.',
  );
}

const app = createApp();

// A8 cleanup job (daily + boot catch-up; no-op in tests).
schedulePurgeJob();
scheduleTicketAutoCloseJob();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'MPX Global backend listening');
  // Which OTP transports are actually live. Logged at boot so a deploy missing
  // its SMS key or SMTP password is visible immediately, rather than at some
  // user's first failed login.
  logger.info(describeOtpTransports(), 'otp delivery transports');

  /**
   * 🔴 "Configured" is not "working". The line above only says a password is
   * present; this one actually connects and authenticates. Until 2026-09-25
   * nothing called `verifyEmailTransport` at all, so a server whose SMTP was
   * broken booted quietly and the first person to learn about it was a user who
   * could not log in.
   *
   * Fire-and-forget on purpose: a slow or unreachable mail host must not hold
   * up the listener. It is a warning, not a gate — the app is still useful with
   * SMS OTP while email is down.
   */
  verifyEmailTransport()
    .then((ok) => {
      if (ok) logger.info('smtp: transport verified');
    })
    .catch(() => {}); // it already logged; never let the check itself crash boot

  /**
   * 🔴 Bank account numbers are encrypted at rest (2026-09-25). Without the key
   * the FIRST attempt to save one fails with a 500 and nothing before that
   * moment hints at why — exactly the shape of the SMTP failure found the same
   * day, where "configured" was never checked against "working".
   *
   * A warning, not a refusal to boot: everything else on the platform works
   * without this key, and taking the whole API down over one feature would be a
   * worse failure than the one it prevents.
   */
  if (!isFieldCryptoConfigured()) {
    logger.warn(
      'FIELD_ENCRYPTION_KEY is not set (or is not 32 bytes). Saving or reading a bank account will fail. Generate one with `openssl rand -base64 32` and back it up with the database password — losing it makes every stored account number unreadable.',
    );
  }
});

// M4-G — live delivery rides on the same HTTP server. §7.1: only new messages
// and freeze events go over it; everything else stays REST, so a dropped socket
// degrades the experience and never the application.
attachSocket(server);

/**
 * §7.7 — Socket.io keeps rooms IN MEMORY within one process. The moment hosting
 * runs more than one, a message sent through process A never reaches a user
 * connected to process B, silently. Redis is already a dependency (rate limits),
 * so the adapter is wired whenever a URL is configured.
 *
 * ⚠️ Deployment note: this and the A8 purge job (M2-H) both assume a single
 * process today. The purge must be pinned to one instance if that changes.
 */
await attachRedisAdapter();

// console.log("asdf")
// Graceful shutdown: stop accepting connections, close the DB, then exit.
// closeDatabase() is idempotent, so the database.js signal handler and this one
// cooperate safely.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    logger.info({ signal }, 'shutdown signal received');
    server.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
  });
}

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception');
  process.exit(1);
});
