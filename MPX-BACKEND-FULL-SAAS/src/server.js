import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { connectDatabase, closeDatabase } from './config/database.js';
import './models/index.js'; // register every model with mongoose

// Connect to MongoDB before accepting traffic — a payments-adjacent service must
// not serve requests without its database.
try {
  await connectDatabase();
} catch (err) {
  logger.fatal({ err: { name: err.name, message: err.message } }, 'could not connect to mongodb; exiting');
  process.exit(1);
}

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'MPX Global backend listening');
});

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
