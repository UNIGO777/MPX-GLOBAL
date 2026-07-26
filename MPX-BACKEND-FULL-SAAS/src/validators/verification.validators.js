import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';

// Just the org id in the path.
export const reviewParams = {
  params: z.object({ id: zObjectId() }),
};

// Rejection requires a reason.
export const rejectSchema = {
  params: z.object({ id: zObjectId() }),
  body: z.object({ reason: zString({ min: 3, max: 500 }) }),
};
