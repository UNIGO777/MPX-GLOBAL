import { z } from 'zod';

import { zObjectId } from './helpers.js';

/** B8 web notification centre — the caller's OWN notifications only. */
export const listNotifications = {
  query: z.object({
    before: z.coerce.date().optional(),
    unread: z.enum(['1']).optional(),
  }),
};

export const notificationIdParam = {
  params: z.object({ id: zObjectId() }),
};
