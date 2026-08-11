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
