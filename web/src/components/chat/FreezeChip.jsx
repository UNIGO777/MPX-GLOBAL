import { AlertIcon, SlashIcon } from '../ui/icons.jsx';

/**
 * M4-19 — the single most important convention in this module: **colour never
 * carries meaning alone.** The server returns `{ tone, text }` and this renders
 * BOTH. There is no variant of this component that shows a bare dot or a bare
 * tint, because that is precisely the thing the rule forbids.
 *
 * The tones are the server's, not ours (`views/conversation.view.js`):
 *   yellow  "Product under review"            — admin took the product down; reversible
 *   red     "Conversation blocked by MPX Global" — this one chat was blocked
 *   red     "Product no longer available"     — the product was purged at 180 days
 *   none    (nothing renders)
 *
 * ⚠️ Never render more than one of these on a row. `frozenReason` holds the
 * FIRST reason and never changes while it applies (M4-29), so a thread that was
 * blocked and then hit by a takedown keeps the block label — one label, always.
 */
const TONES = {
  yellow: { className: 'bg-warning-50 text-warning-700', Icon: AlertIcon },
  red: { className: 'bg-danger-50 text-danger-700', Icon: SlashIcon },
};

const SIZES = {
  md: 'px-2.5 py-1 text-[12px]',
  // Sized to sit on the same baseline rhythm as a chat row's preview line, so
  // swapping one for the other does not change the row's height.
  sm: 'px-2 py-0.5 text-[11.5px] leading-4',
};

export function FreezeChip({ label, wrap = false, size = 'md', className = '' }) {
  const tone = TONES[label?.tone];
  // `tone: 'none'` (an open thread — and an account-frozen one, which the server
  // deliberately leaves unlabelled) renders nothing at all.
  if (!tone || !label?.text) return null;

  const { Icon } = tone;
  return (
    <span
      className={`inline-flex max-w-full gap-1.5 rounded-full font-semibold ${SIZES[size] ?? SIZES.md} ${
        wrap ? 'items-start text-left' : 'items-center whitespace-nowrap'
      } ${tone.className} ${className}`}
    >
      <Icon
        className={`shrink-0 ${size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} ${wrap ? 'mt-0.5' : ''}`}
        aria-hidden="true"
      />
      {/* Wrapped in a table cell, truncated in a tight row — but never cut in a
          place where the reason becomes unreadable. */}
      <span className={wrap ? 'leading-snug' : 'truncate'}>{label.text}</span>
    </span>
  );
}
