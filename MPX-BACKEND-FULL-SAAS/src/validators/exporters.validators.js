import { z } from 'zod';

import { zObjectId } from './helpers.js';

// Public exporter profile lookup by id.
export const exporterIdParam = {
  params: z.object({ id: zObjectId() }),
};
