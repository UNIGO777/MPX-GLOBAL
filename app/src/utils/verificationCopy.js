/**
 * Headline copy for each `kycStatus` state — shared by the Verification hub
 * and the condensed verification card on Home, so the same status never
 * reads two different ways in two places (the failure mode `kycStatus.js`
 * already guards against for chip colour/label).
 *
 * `verified` IS present here (unlike `KYC_STATUS_CHIP`) — this pair drives a
 * headline + one line of body copy, not the chip, so there is no risk of it
 * growing into a second "verified" badge.
 */
export const KYC_STATE_TITLE = {
  pending: 'Verify your business',
  submitted: 'In review',
  verified: 'Verified',
  rejected: 'One more thing',
};

export const KYC_STATE_SUBTITLE = {
  pending: 'Add a document and get the tick.',
  submitted: 'We have your documents — no action needed.',
  verified: 'Your company carries the verified tick.',
  rejected: 'A quick fix and we can finish this.',
};

/**
 * The verification redesign (server 2026-08-19) added three states that
 * `kycStatus` alone cannot express: a reviewer has REQUESTED a document, a
 * profile change is PARKED, or a verification has been REVOKED.
 *
 * 🔴 Why this exists as a shared function: a verified company can be sitting on
 * an outstanding document request, and `kycStatus` still reads `verified`. Any
 * surface keying off the status alone would say "nothing to do" while the
 * company is in fact the one being waited on. Returning `null` means the plain
 * status copy above is the whole truth.
 *
 * Ordered by consequence — a revocation outranks a request, which outranks a
 * parked change.
 */
export function verificationAttention(v) {
  if (!v) return null;

  if (v.revocation) {
    return {
      title: 'Verification withdrawn',
      body: 'Open to see why and what to send.',
      tone: 'danger',
    };
  }

  const open = (v.documentRequests ?? []).filter((r) => !r.fulfilledAt);
  if (open.length > 0) {
    return {
      title: 'A document was requested',
      body: open[0].note || 'Our team needs one more document.',
      tone: 'warning',
    };
  }

  const pc = v.pendingChanges;
  if (pc?.state === 'awaiting_documents') {
    return {
      title: 'Profile change — documents needed',
      body: 'Add a document supporting your new details.',
      tone: 'warning',
    };
  }
  if (pc?.state === 'rejected') {
    return {
      title: 'Profile change not approved',
      body: 'Open to see the reason and resubmit.',
      tone: 'danger',
    };
  }
  if (pc) {
    return {
      title: 'Profile change under review',
      body: 'Your profile and tick are unchanged meanwhile.',
      tone: 'warning',
    };
  }

  return null;
}
