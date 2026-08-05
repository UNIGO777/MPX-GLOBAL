/**
 * The four `kycStatus` states, one definition — shared by every screen that
 * shows a status chip (Company Profile, Verification hub, Profile). A second
 * copy of this map is how one of them quietly drifts to a different colour or
 * label for the same status.
 *
 * 🔴 `verified` is deliberately absent: the verified state is the TICK
 * (`VerifiedBadge`), never a chip. CLAUDE.md / design brief §1.2 — one badge
 * only, and this map must not grow a `verified` entry that invites a second one.
 */
export const KYC_STATUS_CHIP = {
  pending: { tone: 'neutral', label: 'Not submitted' },
  submitted: { tone: 'warning', label: 'In review' },
  rejected: { tone: 'danger', label: 'Needs attention' },
};

/** `null` for verified — the caller renders VerifiedBadge instead, never both. */
export function statusChipFor(kycStatus) {
  if (kycStatus === 'verified') return null;
  return KYC_STATUS_CHIP[kycStatus] ?? null;
}
