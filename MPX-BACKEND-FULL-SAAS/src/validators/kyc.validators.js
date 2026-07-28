import { z } from 'zod';

import { KYC_DOC_TYPE, ENTITY_TYPE } from '../models/enums.js';

// KYC document upload. Multipart text fields (the file itself is handled by multer
// + magic-byte verification, not here). `entityType` is optional at the boundary:
// exporters already have it from signup (and a mismatch is rejected in the
// service); a buyer — who has none from signup — must supply it (enforced in the
// service). docType is validated against the entity type in the service too.
export const kycUpload = {
  body: z.object({
    docType: z.enum(KYC_DOC_TYPE),
    entityType: z.enum(ENTITY_TYPE).optional(),
  }),
};
