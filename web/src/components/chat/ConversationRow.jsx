import { formatListTime } from '../../lib/format.js';
import { Skeleton } from '../ui/Skeleton.jsx';
import { BoxIcon } from '../ui/icons.jsx';
import { CompanyAvatar } from './CompanyAvatar.jsx';
import { FreezeChip } from './FreezeChip.jsx';

/**
 * One row in the chat list — used by the full page and by the dock's panel, so
 * the two can never drift apart.
 *
 * 🔴 REDESIGNED 2026-08-18 (second pass). The first pass separated the facts but
 * left the row with no REST STATE: it was transparent on a tinted rail and only
 * became an object on hover, so a list at rest was floating text. Four surfaces
 * within a few percent of each other (rail, canvas, header, cards) meant nothing
 * declared "column" or "canvas" either.
 *
 * The rule now: **the rail is a tinted field, and everything actionable on it is
 * a white card.** The search box and every conversation are objects; the space
 * between them is the field. That is what gives the column architecture at rest.
 *
 * Hierarchy, top to bottom — two type sizes, weight and colour do the rest:
 *
 *   who      the counterparty company, 14px semibold, with the time on its
 *            baseline so the row has a clean top rail
 *   what     the PRODUCT, as a tinted chip — not muted grey text. Every thread
 *            is bound to exactly one product (M4-4/M4-5) and the same supplier
 *            can appear several times with different ones, so the product is the
 *            DISAMBIGUATOR, not decoration. It is also the only colour in the
 *            rail, which is the point: this is a trade inbox, not a messenger.
 *   last     the preview, quietened to 12px, one line
 *
 * Unread is a BOOLEAN — weight, a dot on the avatar, an accented time. There is
 * deliberately no "3 new" count: the server keeps none (it derives unread by
 * comparing two timestamps), so a number here could only be invented.
 */
export function ConversationRow({ conversation, active = false, onSelect, compact = false }) {
  const { title, product, counterparty, lastMessagePreview, lastMessageAt, unread, frozen, frozenLabel } =
    conversation;

  const company = counterparty?.name ?? title;

  /**
   * 🔴 No outline around each conversation. A ring on every row drew boxes down
   * a narrow column and turned a list into a stack of containers; the rows are
   * separated by a FADING hairline instead, so the rhythm comes from the gaps
   * rather than from borders.
   *
   * Selection is carried by the fill and the accent bar. A frozen row keeps its
   * wash while open and merely deepens — turning it white on select hid the
   * freeze at the one moment the reader is looking straight at the thread.
   */
  const surface = frozen
    ? active
      ? 'bg-danger-50'
      : 'bg-danger-50/40 hover:bg-danger-50/70'
    : active
      ? 'bg-white shadow-[0_1px_2px_rgba(0,5,23,0.06)]'
      : unread
        // A STANDING fill, with no hover variant: the colour is the unread
        // state itself, and shifting it under the cursor made it read as a
        // hover effect instead. Selection still wins — opening a row clears
        // unread within a second anyway.
        ? 'bg-surface-unread'
        : 'hover:bg-white/70';

  return (
    <li className="relative">
      <button
        type="button"
        onClick={() => onSelect(conversation)}
        aria-current={active ? 'true' : undefined}
        className={`group relative flex w-full items-start gap-3 overflow-hidden rounded-lg px-3 text-left transition-colors ${
          compact ? 'py-2' : 'py-2.5'
        } ${surface} focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400`}
      >
        {active && (
          <span
            aria-hidden="true"
            className={`absolute inset-y-2 left-0 w-[3px] rounded-r-full ${
              frozen ? 'bg-danger-500' : 'bg-primary-600'
            }`}
          />
        )}

        <span className="relative shrink-0">
          <CompanyAvatar name={company} logo={counterparty?.logo} size="md" />
          {unread && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary-600">
              <span className="sr-only">Unread</span>
            </span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          {/* Company and time share a baseline — the row's top rail. */}
          <span className="flex items-baseline gap-2">
            <span
              className={`min-w-0 flex-1 truncate text-[14px] leading-snug ${
                unread ? 'font-bold text-ink-900' : 'font-semibold text-ink-800'
              }`}
            >
              {company}
            </span>
            <time
              dateTime={lastMessageAt ?? undefined}
              className={`shrink-0 text-[11px] tabular-nums ${
                unread ? 'font-semibold text-primary-700' : 'font-medium text-ink-400'
              }`}
            >
              {formatListTime(lastMessageAt)}
            </time>
          </span>

          {/* The product anchor, as an object rather than a caption. */}
          {product?.name && (
            <span className="mt-1 flex">
              <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md bg-primary-50 px-1.5 text-[11.5px] font-medium leading-[18px] text-primary-800 ring-1 ring-inset ring-primary-100">
                <BoxIcon className="h-3 w-3 shrink-0 text-primary-500" aria-hidden="true" />
                <span className="truncate">{product.name}</span>
              </span>
            </span>
          )}

          {/* 🔴 The chip REPLACES the preview, it does not sit under it. Every
              freeze posts a system message, so the last message in a frozen
              thread is always the notice the chip already states — the row was
              saying "This conversation has been restricted by …" directly above
              "Conversation blocked by MPX Global". One fact, one line.
              An account-cascade freeze carries no chip (tone: none), so that
              case keeps the preview rather than losing the line entirely. */}
          {frozenLabel?.text ? (
            <span className="mt-1 flex">
              <FreezeChip label={frozenLabel} size="sm" />
            </span>
          ) : (
            /* 🔴 `leading-5` + the same `mt-1.5` as the chip above deliberately.
               The third line is one SLOT: a preview and a freeze chip have to
               occupy identical space or a frozen row stands ~4px taller than its
               neighbours (12px text on a 1.5 line box = 18px, against the chip's
               20px), and a list of rows that are almost the same height reads as
               a mistake rather than as rhythm. */
            <span
              className={`mt-1 block truncate text-[12px] leading-[18px] ${
                unread ? 'text-ink-700' : 'text-ink-500'
              }`}
            >
              {lastMessagePreview || 'No messages yet'}
            </span>
          )}
        </span>
      </button>

      {/* The separator: solid through the middle, dissolving at both edges, so
          it divides the rows without drawing a hard rule across the column.
          Drawn under EVERY row including the last (owner, 2026-08-18) — the list
          reads as closed rather than trailing off. `via-ink-200` rather than the
          old `surface-border`, which was too faint to do the job it exists for. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 bottom-0 h-px bg-gradient-to-r from-transparent via-ink-200 to-transparent"
      />
    </li>
  );
}

/** Matches the row's shape so the list does not jump when data lands. */
export function ConversationRowSkeleton() {
  return (
    <li className="flex items-start gap-3 rounded-lg px-3 py-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
      {/* Sized to the real row's three lines (14 + 20 + 20 with 6px gaps), so the
          list does not jump by ~9px the moment data lands. */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline gap-2">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="ml-auto h-3 w-9 shrink-0" />
        </div>
        <Skeleton className="h-5 w-3/5 rounded-md" />
        <Skeleton className="h-5 w-4/5" />
      </div>
    </li>
  );
}
