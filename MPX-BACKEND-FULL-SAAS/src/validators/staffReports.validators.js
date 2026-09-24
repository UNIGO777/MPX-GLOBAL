import { z } from 'zod';

import { zObjectId } from './helpers.js';

// Step 1e · staff reports. The window is allow-listed (7 / 30 / 90 days).
export const staffReport = {
  query: z.object({
    days: z.coerce.number().int().refine((d) => [7, 30, 90].includes(d), 'days must be 7, 30 or 90').default(30),
    actorId: zObjectId().optional(),
  }),
};
