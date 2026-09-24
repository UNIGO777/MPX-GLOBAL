import cron from 'node-cron';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { autoCloseStaleTickets } from '../services/support.service.js';

/**
 * Support tickets waiting on the company for AUTO_CLOSE_DAYS close themselves
 * (owner, 2026-09-24). Daily at 03:30 server time + one catch-up run at boot,
 * like the product purge. Disabled in tests. Single-process assumption: if
 * hosting ever runs several processes, pin this to one (the per-ticket
 * conditional update keeps a double run harmless anyway).
 */
export function scheduleTicketAutoCloseJob() {
  if (env.NODE_ENV === 'test') return null;

  const run = (label) =>
    autoCloseStaleTickets()
      .then(({ closed }) => {
        if (closed > 0) logger.info({ closed }, 'ticket auto-close complete');
      })
      .catch((err) => logger.error({ err: { name: err?.name, message: err?.message } }, `ticket auto-close ${label} failed`));

  const task = cron.schedule('30 3 * * *', () => run('(scheduled)'));
  run('(boot)');
  return task;
}
