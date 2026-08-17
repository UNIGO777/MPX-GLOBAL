import { apiClient } from './client.js';

/**
 * M4-B — enquiry creation (2026-08-18, the product page's Send Enquiry).
 * BUYER-ONLY on the server (`requireRole('buyer')` + buyer-side-org check +
 * the self-enquiry guard); the app hides the button from non-buyers but the
 * server is what enforces it.
 *
 * One call creates the whole thread server-side (Inquiry → Conversation →
 * composed first message → platform welcome). `note` is the only free text
 * (1–200 chars, required); `fields` is the optional typed bag the server
 * validates against the product's category type — unknown keys are REJECTED,
 * never stripped.
 *
 * 201 = a new thread was created · 200 = a thread with this seller about
 * this product already existed and was returned instead (M4-5: a second
 * enquiry never opens a second thread). `created` carries that distinction.
 */
export const inquiriesApi = {
  create: ({ productId, note, fields }) =>
    apiClient
      .post('/inquiries', { productId, note, ...(fields && Object.keys(fields).length ? { fields } : {}) })
      .then((r) => ({ created: r.status === 201, ...r.data })),
};
