import { z } from 'zod';

/**
 * Strict string field. `z.string()` accepts ONLY a primitive string, so any
 * object — including a Mongo operator payload like { "$gt": "" } — is rejected
 * before it can reach a query. Type a field with this helper wherever user input
 * flows into the database. Never substitute z.coerce.string() or z.any(): those
 * would let a non-string through. Trims by default; applies optional bounds.
 */
export function zString({ min, max, trim = true } = {}) {
  let schema = z.string();
  if (trim) schema = schema.trim();
  if (min != null) schema = schema.min(min);
  if (max != null) schema = schema.max(max);
  return schema;
}

// A 24-char hex Mongo ObjectId. z.string() rejects non-strings, so an operator
// object can't reach the query; the regex rejects malformed ids at the boundary.
export function zObjectId() {
  return z
    .string()
    .trim()
    .regex(/^[a-fA-F0-9]{24}$/, 'must be a valid id');
}
