import { z } from 'zod';

import { zString } from './helpers.js';

// §A22 field set — deliberately IDENTICAL limits to the signup validators
// (auth/signup create these fields; A22 edits them; drift between the two would
// let an edit store what signup would have refused).
//
// `businessProfile` (registrationNumber/taxId) is deliberately NOT editable
// here — it is checked at verification time (same decision as signup, A5).
// `website` is internal-only and not accepted. `logo` moves via its own
// multipart endpoints, never through this body.

const address = z.object({
  line1: zString({ max: 200 }).optional(),
  line2: zString({ max: 200 }).optional(),
  city: zString({ max: 100 }).optional(),
  state: zString({ max: 100 }).optional(),
  postalCode: zString({ max: 20 }).optional(),
});

export const updateMine = {
  body: z
    .object({
      name: zString({ min: 1, max: 200 }).optional(),
      country: zString({ min: 2, max: 2 }).optional(),
      // Buyer-only in practice (the service rejects it for exporters); the enum
      // is validated here so a typo can never reach the model.
      entityType: z.enum(['business', 'individual']).optional(),
      // Storefront copy — cap mirrored in the app's counter (500).
      description: zString({ max: 500 }).optional(),
      address: address.optional(),
    })
    // An empty PATCH is a client bug, not a no-op worth a DB round trip.
    .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update.' }),
};
