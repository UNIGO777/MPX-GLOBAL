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
        // Sentence case (2026-09-24): an uppercase tracked "TODAY" shouted
        // louder than the messages it sits between.
        className={`rounded-full bg-white font-semibold text-ink-500 ring-1 ring-inset ring-ink-200/80 ${
          compact ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-[11.5px]'
        }`}
      >
        {formatDayLabel(at)}
      </span>
    </li>
  );
}
