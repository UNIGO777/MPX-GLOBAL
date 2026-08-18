import mongoose from 'mongoose';

import { isObjectIdLike } from '../utils/idOrSlug.js';

/**
 * M4 §8.4 — the ONE search branch, shared by the party list
 * (`conversation.service.js`) and the staff list (`adminConversations.service.js`).
 *
 * It lives here rather than in either service because §8.4's whole point is that
 * roles differ ONLY in scope: the fields searched, the matching rules and the
 * cursor format must be identical for a buyer, a seller and a moderator. Two
 * copies drift, and the one that drifts is the one that leaks.
 *
 * Three matching modes, chosen by the shape of the input and by what the last
 * query found:
 *
 *   id     the input is an ObjectId → exact match on either org. Never a text
 *          search: pasting an id is a lookup, not a phrase.
 *   text   native `$text` over the three denormalised name fields (§A26 — Atlas
 *          does not exist on a self-hosted VPS). Whole words only.
 *   regex  the fallback below.
 *
 * 🔴 Why a fallback exists at all (owner, 2026-08-17). Native `$text` matches
 * WHOLE WORDS: "Tex" does not find "Textiles", which reads as a broken search
 * box to anyone who types a partial company name. `m4.md` §8.3 names an anchored
 * regex as the sanctioned answer and explicitly rules out the obvious
 * alternative — MongoDB allows only ONE text index per collection, so a second
 * index is not available to us.
 *
 * The fallback runs only when `$text` found NOTHING, so the indexed path stays
 * the common case and the regex scan is paid for only by searches that would
 * otherwise have returned an empty list.
 */

// The three denormalised names on Conversation. Message CONTENT is deliberately
// absent — M4-32: the list is searched, never the messages inside it.
export const SEARCH_FIELDS = Object.freeze([
  'productNameSnapshot',
  'buyerOrgName',
  'exporterOrgName',
]);

/**
 * A regex built from raw user input is a denial-of-service waiting to happen:
 * `(a+)+$` pasted into a search box backtracks catastrophically. Escaping every
 * metacharacter turns the input into a literal, so the pattern can only ever be
 * "this exact text", never a program.
 */
function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A second belt: even a fully-escaped 200-character literal is a pointless scan.
// The validator already caps `q` at 200; this caps what reaches the engine.
const MAX_REGEX_SOURCE = 60;

/**
 * Prefix-of-any-word, case-insensitive.
 *
 * `(^|\s)` anchors each alternative to the START of a word, so "tex" finds
 * "Textiles" and "Tex Mills" but not "Latex" — which is what a person typing the
 * first few letters of a company name means. An unanchored match would make
 * every short query match almost everything.
 *
 * The pattern contains no nested quantifiers over the escaped literal, so there
 * is nothing here to backtrack.
 */
function wordPrefixRegex(q) {
  return new RegExp(`(^|\\s)${escapeRegex(q.slice(0, MAX_REGEX_SOURCE))}`, 'i');
}

/** Is this input going to take a NAME branch (text/regex) rather than the id one? */
export function isNameSearch(q) {
  return Boolean(q) && !isObjectIdLike(q);
}

/**
 * The clause for one search, in one mode. Returns `null` for an empty query so
 * callers can drop it rather than merge an empty object.
 *
 * 🔴 The caller must place this inside `$and`, never spread it into the filter.
 * Both the id branch and the regex branch produce an `$or`, and so does the
 * admin list's own org filter — spread, the second `$or` silently overwrites the
 * first and the query quietly means something else entirely.
 */
export function searchClause(q, mode = 'text') {
  if (!q) return null;

  if (isObjectIdLike(q)) {
    const id = new mongoose.Types.ObjectId(q);
    return { $or: [{ buyerOrgId: id }, { exporterOrgId: id }] };
  }

  if (mode === 'regex') {
    const rx = wordPrefixRegex(q);
    return { $or: SEARCH_FIELDS.map((field) => ({ [field]: rx })) };
  }

  // `$text` cannot sit inside `$or`/`$nor`, which is why "names OR ids" can
  // never be one query — but it is perfectly legal inside `$and`.
  return { $text: { $search: q } };
}

/**
 * Cursor = (lastMessageAt, _id, mode).
 *
 * The timestamp alone is not unique, and two threads sharing one would silently
 * skip or repeat a row across pages — hence the `_id` tiebreaker.
 *
 * `mode` is the addition the fallback forced: page 1 of "Tex" may be answered by
 * the regex branch, and page 2 must be answered by the SAME branch. Without it
 * the second page re-runs `$text`, finds nothing, and the list appears to end
 * after one page.
 */
export function encodeCursor(row, mode = 'text') {
  return Buffer.from(`${row.lastMessageAt.getTime()}:${row._id}:${mode}`).toString('base64url');
}

export function decodeCursor(cursor) {
  try {
    const [at, id, mode] = Buffer.from(cursor, 'base64url').toString('utf8').split(':');
    const millis = Number(at);
    if (!Number.isFinite(millis) || !isObjectIdLike(id)) return null;
    return {
      at: new Date(millis),
      id: new mongoose.Types.ObjectId(id),
      // Two-part cursors predate the fallback; they are text searches.
      mode: mode === 'regex' ? 'regex' : 'text',
    };
  } catch {
    return null;
  }
}

/**
 * The company ICONS for a page of conversations, in one query.
 *
 * Only `logo` — never the Organisation document. A thread must not become a
 * back door to a company's record: the name is already denormalised onto the
 * conversation (§8.2) and this adds exactly one more display field.
 *
 * ⚠️ A buyer's logo is NOT public (there is no public buyer page). It reaches a
 * seller here because the two are already party to this conversation, and it
 * reaches nobody else.
 */
export async function loadOrgLogos(Organisation, conversations) {
  const ids = [
    ...new Set(conversations.flatMap((c) => [String(c.buyerOrgId), String(c.exporterOrgId)])),
  ];
  if (ids.length === 0) return new Map();
  const rows = await Organisation.find({ _id: { $in: ids } }).select('logo').lean();
  return new Map(rows.map((o) => [String(o._id), o.logo ?? null]));
}

/** The (lastMessageAt, _id) "strictly older than the cursor" clause. */
export function cursorClause(decoded) {
  return {
    $or: [
      { lastMessageAt: { $lt: decoded.at } },
      { lastMessageAt: decoded.at, _id: { $lt: decoded.id } },
    ],
  };
}

/**
 * Combine a base filter (scope / org targeting) with any number of optional
 * clauses, each of which may carry its own `$or`. Everything optional goes into
 * `$and`, so no two clauses can collide on a key.
 */
export function combineFilter(base, ...clauses) {
  const and = clauses.filter(Boolean);
  return and.length > 0 ? { ...base, $and: and } : { ...base };
}
