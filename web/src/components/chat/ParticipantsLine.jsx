import { ShieldIcon } from '../ui/icons.jsx';

/**
 * M4-1 — every conversation is a room of THREE: the buyer, the seller, and the
 * platform. This line is where that stays visible.
 *
 * 🔴 It is a trust feature, not a decoration, and the plan is explicit that it
 * must not be tucked behind an overflow menu. The platform can read every
 * thread; showing it in the room from the first message makes that DISCLOSURE
 * rather than surveillance. Both sides know, always.
 *
 * The server composes the array (always exactly three, platform last) and the
 * platform is never a member of `parties` — admin access comes from role, never
 * from membership (M4-2). This renders what it is sent.
 */
export function ParticipantsLine({ participants, className = '' }) {
  const platform = participants?.find((p) => p.type === 'platform');
  if (!platform) return null;

  /**
   * 🔴 This is the platform DISCLOSURE, not a roster.
   *
   * The header names the counterparty (party view) or both companies (staff
   * view) directly above it, so listing all three here printed the same names
   * twice in one bar. What has to be visible — and what M4-1 is actually about —
   * is that MPX Global can read the thread. So that is what it says.
   */
  return (
    // `shrink-0` + `whitespace-nowrap`: this now shares a nowrap row with the
    // product in the thread header, and the DISCLOSURE is not the thing that
    // gives — the product truncates instead (M4-1: it must stay legible).
    <p className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] text-ink-500 ${className}`}>
      <ShieldIcon className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden="true" />
      <span>
        <span className="font-semibold text-primary-800">{platform.name}</span> is in this
        conversation
      </span>
    </p>
  );
}
