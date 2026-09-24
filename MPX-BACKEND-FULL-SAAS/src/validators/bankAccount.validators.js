import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';

/**
 * Exporter bank details (owner, 2026-09-24 — quotation builder).
 *
 * 🔴 `.strict()` throughout: unknown keys are REJECTED, never stripped. A typo
 * in a field name on a payment document must fail loudly, not vanish and leave
 * the exporter believing they entered something they did not.
 *
 * The account number is validated only as SHAPE — digits, spaces and dashes, up
 * to 34 characters (the IBAN maximum). We deliberately do not guess a country's
 * format: a wrong "helpful" rule would reject a valid account, and we are not
 * the party verifying it anyway (that is C7, penny-drop, and it belongs with a
 * real payout path that does not exist in Phase 1).
 */
const accountNumber = zString({ min: 4, max: 34 }).regex(
  /^[0-9A-Za-z][0-9A-Za-z -]*$/,
  'account number may contain letters, digits, spaces and dashes only',
);

const swift = zString({ min: 8, max: 11 }).regex(/^[A-Za-z0-9]+$/, 'expected a SWIFT/BIC code');
const ifsc = zString({ min: 11, max: 11 }).regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, 'expected an IFSC code');

const base = {
  label: zString({ min: 1, max: 60 }),
  beneficiary: zString({ min: 2, max: 140 }),
  bankName: zString({ min: 2, max: 140 }),
  branch: zString({ min: 1, max: 140 }).optional(),
  swift: swift.optional(),
  ifsc: ifsc.optional(),
  isDefault: z.boolean().optional(),
};

export const createBankAccountSchema = {
  body: z.object({ ...base, accountNumber }).strict(),
};

/**
 * Every field optional on edit, but at least one required — an empty PATCH that
 * silently succeeds reads as "saved" when nothing was.
 */
export const updateBankAccountSchema = {
  params: z.object({ id: zObjectId() }),
  body: z
    .object({ ...base, accountNumber: accountNumber.optional() })
    .strict()
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: 'nothing to update' }),
};

export const bankAccountParams = {
  params: z.object({ id: zObjectId() }),
};
