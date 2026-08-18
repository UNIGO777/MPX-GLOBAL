import { formatDayLabel } from '../../lib/format.js';

/**
 * Day marker between message groups: "Today" / "Yesterday" / a date.
 *
 * A centred PILL rather than a rule-with-text: on a tinted canvas the hairline
 * version read as a divider between sections, when what it marks is simply a
 * gap in time inside one conversation.
 */
export function DateSeparator({ at, compact = false }) {
  return (
    <li className={`flex justify-center px-3 ${compact ? 'my-2.5' : 'my-4'}`} aria-hidden="true">
      <span
        className={`rounded-full bg-white/85 font-semibold uppercase tracking-[0.08em] text-ink-500 shadow-[0_1px_2px_rgba(0,5,23,0.06)] ring-1 ring-inset ring-white/60 backdrop-blur-sm ${
          compact ? 'px-2.5 py-0.5 text-[9.5px]' : 'px-3 py-1 text-[11px]'
        }`}
      >
        {formatDayLabel(at)}
      </span>
    </li>
  );
}
