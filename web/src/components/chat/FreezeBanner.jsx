import { AlertIcon, SlashIcon, InfoIcon } from '../ui/icons.jsx';

/**
 * The composer's replacement when a thread is frozen.
 *
 * 🔴 It REPLACES the composer — it does not sit above a greyed-out one. A
 * disabled textarea with a cursor in it invites typing and then eats it; a
 * banner says plainly that this conversation takes no new messages and why.
 *
 * Reading is untouched in every frozen state (M4-22): freeze kills the composer,
 * never the transcript.
 *
 * Copy is the server's, verbatim. The one thing this NEVER shows is who blocked
 * the chat — both parties see the reason (M4-25), neither ever sees the admin
 * behind it, exactly as a seller never sees `takedown.byUserId`.
 */
const VARIANTS = {
  yellow: {
    Icon: AlertIcon,
    wrap: 'bg-gradient-to-r from-warning-50 to-warning-50/20 ring-warning-200/70',
    bar: 'bg-warning-500',
    icon: 'text-warning-600',
    title: 'text-warning-900',
  },
  red: {
    Icon: SlashIcon,
    wrap: 'bg-gradient-to-r from-danger-50 to-danger-50/20 ring-danger-200/70',
    bar: 'bg-danger-500',
    icon: 'text-danger-600',
    title: 'text-danger-900',
  },
  // The account-block cascade: the server sends no chip for it, so this neutral
  // variant is the only place a party learns why the thread went quiet.
  none: {
    Icon: InfoIcon,
    wrap: 'bg-gradient-to-r from-ink-50 to-ink-50/20 ring-surface-border',
    bar: 'bg-ink-300',
    icon: 'text-ink-500',
    title: 'text-ink-800',
  },
};

/**
 * ⚠️ Keyed by the server's EXACT label text, because a party's payload does not
 * carry `frozenReason` — that is staff-only. These strings are the contract
 * (`views/conversation.view.js`); if one is reworded there, it must be reworded
 * here in the same change or the thread falls back to the neutral sentence.
 */
const EXPLANATIONS = {
  'Product under review': 'Messaging is paused while MPX Global reviews this product.',
  'Product no longer available':
    'This product has been removed. The conversation is closed, but you can still read it.',
};

const ACCOUNT_EXPLANATION = 'The other party’s account is currently unavailable on MPX Global.';

/**
 * `label` is the server's `frozenLabel`; `blockedReason` is the moderator's own
 * words, shown to both parties.
 */
export function FreezeBanner({ label, blockedReason, compact = false, className = '' }) {
  const variant = VARIANTS[label?.tone] ?? VARIANTS.none;
  const { Icon } = variant;

  const heading = label?.text ?? 'This conversation is paused';
  // A blocked chat carries the moderator's own reason instead of a canned line.
  const explanation = EXPLANATIONS[label?.text] ?? ACCOUNT_EXPLANATION;

  return (
    // 🔴 A STATUS STRIP, not a slab. This was a full-width block of pale red
    // ~90px tall — the loudest thing on the screen, for a state the thread's
    // own notices already announced. It now shares the in-thread notice's
    // vocabulary (accent bar, tint fading away from it) in the freeze's tone,
    // and puts the heading and the reason on ONE wrapping line, roughly halving
    // the height. It stays full width because it replaces the composer, and a
    // narrow strip where a composer used to be reads as a leftover control.
    <div
      role="status"
      className={`relative overflow-hidden rounded-xl ring-1 ring-inset ${
        compact ? 'py-2 pl-3 pr-2.5' : 'py-2.5 pl-[1.125rem] pr-4'
      } ${variant.wrap} ${className}`}
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${variant.bar}`} aria-hidden="true" />
      <div className="flex items-start gap-2.5">
        <Icon
          className={`mt-[2px] shrink-0 ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${variant.icon}`}
          aria-hidden="true"
        />
        <p className={`min-w-0 flex-1 leading-snug ${compact ? 'text-[11.5px]' : 'text-[13px]'}`}>
          <span className={`font-semibold ${variant.title}`}>{heading}</span>
          <span aria-hidden="true" className="mx-1.5 text-ink-300">·</span>
          {blockedReason ? (
            <>
              <span className="font-medium text-ink-700">Reason: </span>
              <span className="text-ink-700">{blockedReason}</span>
            </>
          ) : (
            <span className="text-ink-600">{explanation}</span>
          )}
        </p>
      </div>
    </div>
  );
}
