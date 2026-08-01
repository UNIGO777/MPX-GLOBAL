import { z } from 'zod';

import { zString, zObjectId } from './helpers.js';
import { CURRENCIES } from '../models/enums.js';

/**
 * M4-B — the enquiry form (M4-7 / M4-9).
 *
 * The field set follows the sub-category's `type`, exactly as the product form
 * does — so the shape cannot be validated by zod alone (it needs the category
 * from the DB). zod checks the envelope; `resolveInquiryFields()` below picks
 * the right set once the leaf is known.
 *
 * Unknown keys are REJECTED, never silently stripped. `fields` lands in a Mixed
 * schema path, so anything the validator lets through is stored verbatim —
 * "strip and carry on" would let a typo vanish without the buyer ever learning
 * their requirement was dropped.
 */

const currency = z.enum(CURRENCIES);
const countryCode = zString({ min: 2, max: 2 }).regex(/^[A-Za-z]{2}$/, 'expected an ISO alpha-2 country code');

// Locked 2026-07-31 (m4.md §14 O2) — mirrors Product's own goods/service split
// so the enquiry and the listing speak the same language.
const GOODS_FIELDS = {
  quantity: z.coerce.number().positive().optional(),
  unit: zString({ min: 1, max: 40 }).optional(),
  targetPrice: z.coerce.number().nonnegative().optional(),
  currency: currency.optional(),
  deliveryCountry: countryCode.optional(),
  deliveryTimeline: zString({ min: 1, max: 200 }).optional(),
};

const SERVICE_FIELDS = {
  engagementType: zString({ min: 1, max: 120 }).optional(),
  budget: z.coerce.number().nonnegative().optional(),
  currency: currency.optional(),
  timeline: zString({ min: 1, max: 200 }).optional(),
  deliveryModel: zString({ min: 1, max: 120 }).optional(),
};

export const FIELD_SETS = Object.freeze({ goods: GOODS_FIELDS, service: SERVICE_FIELDS });

/**
 * Envelope only. `fields` is checked against the category type in the service,
 * where the leaf is available.
 */
export const createInquiry = {
  body: z.object({
    productId: zObjectId(),
    // The ONLY free text in an enquiry (M4-7). Required — an enquiry with no
    // structured fields and no note says nothing to the seller.
    note: zString({ min: 1, max: 200 }),
    fields: z.record(z.string(), z.unknown()).optional(),
  }),
};

/**
 * Validate the raw `fields` bag against the leaf's type.
 * Throws a plain Error carrying `clientMessage`; the caller maps it to a 400.
 */
export function resolveInquiryFields(rawFields, categoryType) {
  if (!rawFields || Object.keys(rawFields).length === 0) return {};

  const shape = FIELD_SETS[categoryType];
  if (!shape) {
    const err = new Error(`no enquiry field set for category type: ${categoryType}`);
    err.clientMessage = 'This category cannot take an enquiry yet.';
    throw err;
  }

  const unknown = Object.keys(rawFields).filter((key) => !(key in shape));
  if (unknown.length > 0) {
    const err = new Error(`unknown enquiry field(s): ${unknown.join(', ')}`);
    err.clientMessage = `Unknown field "${unknown[0]}" for this category.`;
    throw err;
  }

  const parsed = z.object(shape).safeParse(rawFields);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const err = new Error(`invalid enquiry field: ${first.path.join('.')} — ${first.message}`);
    err.clientMessage = `"${first.path.join('.')}" is not valid for this category.`;
    throw err;
  }

  // A price or budget without a currency is ambiguous across the marketplace's
  // many currencies — the same rule §A27.1 enforces on the search side.
  const amount = parsed.data.targetPrice ?? parsed.data.budget;
  if (amount !== undefined && !parsed.data.currency) {
    const err = new Error('amount without currency');
    err.clientMessage = 'Please choose a currency for the amount you entered.';
    throw err;
  }

  // Drop keys the buyer did not send, so `fields` never stores a bag of nulls.
  return Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined));
}
