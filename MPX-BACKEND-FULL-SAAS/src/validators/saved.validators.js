import { z } from 'zod';

import { zObjectId } from './helpers.js';

export const saveItem = {
  body: z.object({
    targetType: z.enum(['product', 'supplier']),
    targetId: zObjectId(),
  }),
};

export const savedIdParam = {
  params: z.object({ id: zObjectId() }),
};

export const listSaved = {
  query: z.object({
    targetType: z.enum(['product', 'supplier']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
};
