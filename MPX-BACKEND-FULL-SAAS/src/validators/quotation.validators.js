import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';
import { CURRENCIES } from '../models/enums.js';

/**
 * Quotation input (Module 4, month 2).
 *
 * 🔴 Money arrives as INTEGER MINOR UNITS (`rateMinor`, `amountMinor`) and never
 * as a decimal. A float on the wire is where rounding disputes start, and the
 * server recomputes every total from these anyway — a `total` in the body is not
 * accepted at all, which is why no schema here has one.
 *
 * 🔴 `.strict()`: unknown keys are REJECTED, not stripped. A mistyped field on a
 * commercial document must fail loudly rather than vanish.
 */
/**
 * 🔴 Money has a CEILING, and the message says so.
 *
 * Owner hit this: typing 5e33 into a counter-offer answered "Invalid request."
 * — zod's `.int()` means a SAFE integer, so an absurd figure was refused with
 * nothing a person could act on. A stated maximum is both a real guard and a
 * sentence someone can read.
 *
 * 1e12 minor units = ten billion in major units (₹1,000 crore). No single
 * quotation is that, and it keeps every derived figure — line amounts, taxes,
 * milestone splits — far inside `Number.MAX_SAFE_INTEGER` (9.007e15), where the
 * arithmetic is still exact.
 */
export const MAX_MINOR = 1_000_000_000_000;
const TOO_LARGE = 'That amount is too large. Check the figure.';

// 🔴 `.max()` FIRST. Zod's `.int()` means a SAFE integer, so an absurd figure
// trips the int check and answers "Enter a whole amount." — which reads as a
// decimals complaint about a number whose real problem is its size. Checking the
// ceiling first means the message always matches what is actually wrong.
const minor = z.number().max(MAX_MINOR, TOO_LARGE).int('Enter a whole amount in the smallest unit.').min(0);

const item = z
  .object({
    name: zString({ min: 1, max: 200 }),
    spec: zString({ min: 1, max: 400 }).optional(),
    hsCode: zString({ min: 1, max: 20 }).optional(),
    qty: z.number().positive(),
    unit: zString({ min: 1, max: 20 }).optional(),
    rateMinor: minor,
  })
  .strict();

const charge = z
  .object({
    label: zString({ min: 1, max: 120 }),
    // `null` is meaningful — it prints as "Included", which is not zero.
    amountMinor: minor.nullable().optional(),
  })
  .strict();

const tax = z.object({ label: zString({ min: 1, max: 120 }), ratePct: z.number().min(0).max(100) }).strict();
const milestone = z
  .object({ label: zString({ min: 1, max: 160 }), percent: z.number().min(0).max(100) })
  .strict();

export const createDraftSchema = {
  body: z.object({ conversationId: zObjectId() }).strict(),
};

export const updateDraftSchema = {
  params: z.object({ id: zObjectId() }),
  body: z
    .object({
      currency: z.enum(CURRENCIES),
      validUntil: z.coerce.date(),
      incoterm: zString({ min: 1, max: 40 }),
      portOfLoading: zString({ min: 1, max: 120 }),
      portOfDischarge: zString({ min: 1, max: 120 }),
      leadTime: zString({ min: 1, max: 120 }),
      items: z.array(item).max(50),
      charges: z.array(charge).max(20),
      taxes: z.array(tax).max(10),
      taxNote: zString({ min: 1, max: 400 }),
      payment: z
        .object({
          milestones: z.array(milestone).max(10),
          note: zString({ min: 1, max: 300 }).optional(),
        })
        .strict(),
      delivery: z
        .object({
          rows: z
            .array(z.object({ label: zString({ min: 1, max: 80 }), value: zString({ min: 1, max: 120 }) }).strict())
            .max(10),
          note: zString({ min: 1, max: 300 }).optional(),
        })
        .strict(),
      termsVersion: zString({ min: 1, max: 20 }),
      additionalDetails: zString({ min: 1, max: 2000 }),
      supplier: z.record(z.string(), z.union([z.string(), z.boolean()])),
      buyer: z.record(z.string(), z.union([z.string(), z.boolean()])),
    })
    .strict()
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: 'nothing to update' }),
};

export const sendSchema = {
  params: z.object({ id: zObjectId() }),
  body: z.object({ bankAccountId: zObjectId().optional() }).strict(),
};

export const quotationParams = { params: z.object({ id: zObjectId() }) };

export const negotiateSchema = {
  params: z.object({ id: zObjectId() }),
  body: z
    .object({
      // Minor units, like every other amount here. `positive` not `min(0)`: an
      // offer of zero is not a negotiation. Same ceiling as every other money
      // field, and it says why rather than answering "Invalid request."
      totalMinor: z
        .number()
        .max(MAX_MINOR, TOO_LARGE) // before `.int()` — see the note on `minor`
        .int('Enter a whole amount.')
        .positive('Enter an amount greater than zero.'),
      note: zString({ min: 1, max: 300 }).optional(),
    })
    .strict(),
};

export const acceptCodeSchema = {
  params: z.object({ id: zObjectId() }),
  body: z
    .object({
      // Digits only, and length-bounded, so a code field can never carry a
      // regex, an object or anything else into the OTP check.
      code: z.string().regex(/^\d{4,8}$/, 'Enter the code from your email.'),
    })
    .strict(),
};

export const draftWithAiSchema = {
  // An enum, not a free string: the target selects a fixed prompt, and an
  // unknown one must be a 400 rather than something the service has to guess at.
  params: z.object({ id: zObjectId(), target: z.enum(['milestones', 'charges', 'details']) }),
  body: z
    .object({
      // A sentence, not a document. The cap is the prompt-injection surface as
      // much as it is a cost control: there is no room here to paste a new set
      // of instructions for the model.
      instruction: zString({ min: 3, max: 300 }),
    })
    .strict(),
};

export const declineSchema = {
  params: z.object({ id: zObjectId() }),
  body: z.object({ reason: zString({ min: 3, max: 500 }).optional() }).strict(),
};

export const listForConversationSchema = {
  params: z.object({ conversationId: zObjectId() }),
};
