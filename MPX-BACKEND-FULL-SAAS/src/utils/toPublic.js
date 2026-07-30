/**
 * A3 — the ONE shared public serialiser.
 *
 * Every public route serialises through this function. No route builds its own
 * field list, because the base `toJSON` transform is a BLACKLIST (whole document
 * minus `select:false` paths) and is therefore unsafe for public output: a field
 * added to a model tomorrow would ship to buyers on its own.
 *
 * This is a whitelist. A model's public surface is declared once, on the model,
 * as `PUBLIC_FIELDS` (+ `PUBLIC_DERIVED` for computed values). A new model field
 * is private by default and can only ever reach a public response by being added
 * to that list deliberately.
 *
 * Copy this pattern for `Product` and `Category` — do not hand-roll an object
 * literal in a controller.
 */

// Mongoose documents expose dotted paths via `.get()`; plain/lean objects need a
// manual walk. Supporting both means callers don't have to care which they hold.
function readPath(doc, path) {
  if (typeof doc?.get === 'function') return doc.get(path);
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), doc);
}

/**
 * @param doc     a Mongoose document or plain object
 * @param fields  PUBLIC_FIELDS — each entry is either `'name'` (copy as-is) or
 *                `['businessProfile.establishedYear', 'establishedYear']`
 *                (read a nested path, publish under a flat key)
 * @param derived PUBLIC_DERIVED — `{ outKey: (doc) => value }` for values that are
 *                computed rather than copied (e.g. a boolean derived from an
 *                internal status that must never itself be exposed)
 * @returns a plain object containing ONLY the whitelisted keys, or null
 */
export function toPublic(doc, { fields = [], derived = {} } = {}) {
  if (!doc) return null;

  const out = {};

  for (const entry of fields) {
    const [path, key] = Array.isArray(entry) ? entry : [entry, entry];
    // `?? null` so an absent field is an explicit null rather than a missing key —
    // clients then get a stable response shape.
    out[key] = readPath(doc, path) ?? null;
  }

  for (const [key, compute] of Object.entries(derived)) {
    out[key] = compute(doc) ?? null;
  }

  return out;
}
