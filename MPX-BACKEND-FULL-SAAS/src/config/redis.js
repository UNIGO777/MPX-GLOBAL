import Redis from 'ioredis';

import { env } from './env.js';
import { logger } from '../utils/logger.js';

// Memoized shared client. `undefined` = not yet resolved; `null` = resolved to
// "no Redis configured". Callers decide the fallback.
let client;

export function getRedisClient() {
  if (client !== undefined) return client;

  if (!env.REDIS_URL) {
    client = null;
    return client;
  }

  client = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 });
  client.on('connect', () => logger.info('redis connected'));
  client.on('error', (err) =>
    logger.error({ err: { name: err.name, message: err.message } }, 'redis error'),
  );
  return client;
}
