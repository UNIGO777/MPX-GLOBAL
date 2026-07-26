import { AppError } from '../utils/AppError.js';

// Reject — never silently strip — any request carrying a key that looks like a
// Mongo/NoSQL operator ($-prefixed), a dotted path (Mongo dot-notation), or a
// prototype-pollution key. Stripping mutates the request quietly; rejecting is
// explicit and shows up in logs. Paired with strict zod validation at each route
// (zString refuses non-strings), this replaces express-mongo-sanitize.
const FORBIDDEN_KEY = /^\$|\./; // starts with "$" OR contains "."
const PROTO_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_DEPTH = 20;

function findForbiddenKey(value, depth = 0) {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const bad = findForbiddenKey(item, depth + 1);
      if (bad) return bad;
    }
    return null;
  }

  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEY.test(key) || PROTO_KEYS.has(key)) return key;
    const bad = findForbiddenKey(value[key], depth + 1);
    if (bad) return bad;
  }
  return null;
}

export function rejectMongoOperators(req, _res, next) {
  // req.query is a read-only getter in Express 5, but reading/iterating it is
  // fine — we never reassign it.
  for (const source of [req.body, req.query, req.params]) {
    if (!source) continue;
    const bad = findForbiddenKey(source);
    if (bad) {
      return next(AppError.badRequest(`rejected forbidden request key: ${bad}`, 'Invalid request.'));
    }
  }
  next();
}
