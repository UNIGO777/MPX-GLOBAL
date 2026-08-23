import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';
import { KYC_DOC_TYPE } from '../models/enums.js';

// Just the org id in the path.
export const reviewParams = {
  params: z.object({ id: zObjectId() }),
};

// Rejection requires a reason.
export const rejectSchema = {
  params: z.object({ id: zObjectId() }),
  body: z.object({ reason: zString({ min: 3, max: 500 }) }),
};

// Verification-redesign (2026-08-19) — staff asks the company for documents.
// The note is REQUIRED and is SHOWN TO THE COMPANY (the dialog says so).
export const requestDocumentsSchema = {
  params: z.object({ id: zObjectId() }),
  body: z.object({
    docTypes: z.array(z.enum(KYC_DOC_TYPE)).min(1).max(KYC_DOC_TYPE.length)
      .refine((a) => new Set(a).size === a.length, { message: 'docTypes must be unique' }),
    note: zString({ min: 3, max: 500 }),
  }),
};
