import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { connectDatabase, closeDatabase } from './config/database.js';
import './models/index.js'; // register every model with mongoose
import { schedulePurgeJob } from './jobs/purgeBlockedProducts.js';
import { attachSocket, attachRedisAdapter } from './realtime/socket.js';

// Connect to MongoDB before accepting traffic — a payments-adjacent service must
// not serve requests without its database.
try {
  await connectDatabase();
} catch (err) {
  logger.fatal({ err: { name: err.name, message: err.message } }, 'could not connect to mongodb; exiting');
  process.exit(1);
}

const app = createApp();

// A8 cleanup job (daily + boot catch-up; no-op in tests).
schedulePurgeJob();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'MPX Global backend listening');
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
