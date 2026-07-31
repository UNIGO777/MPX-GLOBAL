import { z } from 'zod';

import { zString } from './helpers.js';

// Public exporter profile lookup — by ObjectId OR by slug (SEO §1 serves
// /supplier/:slug). The service decides which one it was; this only bounds the
// string, and zString still rejects any non-string (operator) payload.
export const exporterIdParam = {
  params: z.object({ idOrSlug: zString({ min: 1, max: 200 }) }),
};
