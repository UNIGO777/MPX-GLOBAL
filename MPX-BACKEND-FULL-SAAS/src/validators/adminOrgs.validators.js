import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';
import { KYC_STATUS } from '../models/enums.js';

// §7 filters: side · verification · blocked. `q` is a plain string — the service
// regex-escapes and prefix-anchors it (rule 9).
export const listOrganisations = {
  query: z.object({
    side: z.enum(['buyer', 'exporter', 'both']).optional(),
    verification: z.enum(KYC_STATUS).optional(),
    blocked: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    q: zString({ min: 1, max: 100 }).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  }),
};

export const orgIdParam = {
  params: z.object({ id: zObjectId() }),
};
