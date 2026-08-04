import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { connectDatabase, closeDatabase } from './config/database.js';
import './models/index.js'; // register every model with mongoose
import { schedulePurgeJob } from './jobs/purgeBlockedProducts.js';
import { attachSocket, attachRedisAdapter } from './realtime/socket.js';
import { isCloudinaryConfigured } from './config/cloudinary.js';
import { describeOtpTransports } from './services/otp.sender.js';

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

const app = createApp();

// A8 cleanup job (daily + boot catch-up; no-op in tests).
schedulePurgeJob();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'MPX Global backend listening');
  // Which OTP transports are actually live. Logged at boot so a deploy missing
  // its SMS key or SMTP password is visible immediately, rather than at some
  // user's first failed login.
  logger.info(describeOtpTransports(), 'otp delivery transports');
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
