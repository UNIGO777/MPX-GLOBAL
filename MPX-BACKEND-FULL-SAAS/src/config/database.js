import mongoose from 'mongoose';

import { env } from './env.js';
import { logger } from '../utils/logger.js';

const DEFAULT_RETRIES = 5;
const DEFAULT_RETRY_DELAY_MS = 5000;
const SERVER_SELECTION_TIMEOUT_MS = 10_000;

let listenersRegistered = false;
let shutdownRegistered = false;
let closePromise = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Connection errors from the driver can embed the URI (host, sometimes
// credentials). Log a shaped, minimal object rather than the raw error so no
// connection string reaches a log sink.
const shapeError = (err) => ({ name: err?.name, message: err?.message });

function registerConnectionListeners() {
  if (listenersRegistered) return;
  listenersRegistered = true;

  const { connection } = mongoose;
  connection.on('connected', () => logger.info('mongodb connected'));
  connection.on('disconnected', () => logger.warn('mongodb disconnected'));
  connection.on('reconnected', () => logger.info('mongodb reconnected'));
  connection.on('error', (err) => logger.error({ err: shapeError(err) }, 'mongodb connection error'));
}

function registerGracefulShutdown() {
  if (shutdownRegistered) return;
  shutdownRegistered = true;

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      closeDatabase().catch((err) =>
        logger.error({ err: shapeError(err) }, 'error while closing mongodb on shutdown'),
      );
    });
  }
}

// Connect with retry. Each failed attempt is logged and retried after a delay;
// once retries are exhausted the error propagates so the caller can fail-fast
// (a payments-adjacent service must not run without its database).
export async function connectDatabase({
  retries = DEFAULT_RETRIES,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
} = {}) {
  // Fail queries fast instead of buffering them against a dead connection, and
  // reject unknown query fields.
  mongoose.set('bufferCommands', false);
  mongoose.set('strictQuery', true);

  registerConnectionListeners();
  registerGracefulShutdown();

  for (let attempt = 1; ; attempt += 1) {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
        // Build indexes automatically in dev/test only. In production, indexes
        // are created deliberately out-of-band so startup never blocks on a
        // large index build.
        autoIndex: env.NODE_ENV !== 'production',
      });
      return mongoose.connection;
    } catch (err) {
      const noRetriesLeft = attempt >= retries;
      logger.error(
        { attempt, retries, err: shapeError(err) },
        noRetriesLeft
          ? 'mongodb connection failed; no retries left'
          : 'mongodb connection attempt failed; will retry',
      );
      if (noRetriesLeft) throw err;
      await sleep(retryDelayMs);
    }
  }
}

// Idempotent: repeated calls (e.g. the SIGINT handler here plus the server's own
// shutdown) share one close operation.
export function closeDatabase() {
  if (closePromise) return closePromise;

  closePromise = (async () => {
    if (mongoose.connection.readyState === 0) return; // already disconnected
    logger.info('closing mongodb connection');
    await mongoose.connection.close(false);
    logger.info('mongodb connection closed');
  })();

  return closePromise;
}
