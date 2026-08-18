/**
 * Draft-cap guard (D1 · §A15).
 *
 * The server already refuses a create past the draft limit — but refusing
 * AFTER a seller has filled in a whole product form is a bad trade. The M2
 * brief wants the block explained *before* they invest the effort ("the Add
 * action explains rather than silently failing"), so every "+ Add product"
 * surface runs this first.
 *
 * 🔴 This guards the DRAFT limit only. The live-listing cap is a
 * publish-time refusal, not an add-time one — a seller may always keep
 * drafting — and a verified account has no cap at all. The server stays the
 * authority either way; this is courtesy, never enforcement.
 *
 * @returns {string|null} the message to show, or null when adding is fine
 */
export function draftCapBlock(caps) {
  if (!caps || caps.verified !== false) return null;
  const used = caps.drafts?.used;
  const limit = caps.drafts?.limit;
  if (used == null || limit == null || used < limit) return null;
  return `You have ${used} of ${limit} drafts. Publish or delete one to add another — or get verified to lift the limit.`;
}
