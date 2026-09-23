import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';
import { KYC_DOC_TYPE_REQUESTABLE } from '../models/enums.js';

// Just the org id in the path.
export const reviewParams = {
  params: z.object({ id: zObjectId() }),
};

// Rejection requires a reason.
export const rejectSchema = {
  params: z.object({ id: zObjectId() }),
  body: z.object({ reason: zString({ min: 3, max: 500 }) }),
};

/**
 * Remove ONE stored KYC document (2026-09-23). Deliberately per-document and not
 * a side effect of rejecting an organisation: a rejection is usually about one
 * bad file, and wiping the whole submission would force a company to re-send
 * documents that were fine — degrading the resubmit-after-rejection flow that
 * quote Module 7 commits to.
 *
 * The reason is MANDATORY and is what the permanent audit record carries.
 */
export const removeDocumentSchema = {
  params: z.object({ id: zObjectId(), docId: zObjectId() }),
  body: z.object({ reason: zString({ min: 3, max: 500 }) }),
};

// Verification-redesign (2026-08-19) — staff asks the company for documents.
// The note is REQUIRED and is SHOWN TO THE COMPANY (the dialog says so).
export const requestDocumentsSchema = {
  params: z.object({ id: zObjectId() }),
  body: z.object({
    // REQUESTABLE, not the full stored enum — staff must not be able to ask for a
    // retired type the upload endpoint would then reject (see enums.js).
    docTypes: z.array(z.enum(KYC_DOC_TYPE_REQUESTABLE)).min(1).max(KYC_DOC_TYPE_REQUESTABLE.length)
      .refine((a) => new Set(a).size === a.length, { message: 'docTypes must be unique' }),
    note: zString({ min: 3, max: 500 }),
  }),
};
