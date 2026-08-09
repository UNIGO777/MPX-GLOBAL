import { formatDate } from '../../lib/format.js';
import { AlertIcon } from '../ui/icons.jsx';

/**
 * What the SELLER sees on their own taken-down listing (screens 5 and 7).
 *
 * 🔴 TWO ABSOLUTE OMISSIONS, both deliberate:
 *  1. **Never the acting admin.** §A9 — the seller sees the reason and the date;
 *     which staff member acted stays internal. It IS shown on the admin side
 *     (screen 10's row detail), which is why the two views are built separately:
 *     the seller's projection (`/products/mine`) carries only `reason` + `at`,
 *     and the admin aggregation resolves `byName`. Never pass one into the other.
 *  2. **No appeal or "request review" action.** The seller unblock-request flow
 *     is D6 (~2026-08-28) and is not built. A button here would promise a path
 *     that does not exist.
 *
 * The reason is the admin's own words, shown verbatim — the takedown dialog tells
 * them it will be ("say what's wrong and what would fix it"), so it is written to
 * be read by the seller.
 */
export function BlockedBanner({ takedown, className = '' }) {
  if (!takedown) return null;
  const when = formatDate(takedown.at);

  return (
    <div
      role="alert"
      className={`flex gap-3 rounded-lg border border-danger-200 bg-danger-50 p-4 ${className}`}
    >
      <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-danger">
          Removed by the MPX team{when ? ` on ${when}` : ''}
        </p>
        {takedown.reason && (
          <p className="mt-1 text-sm text-ink-800">{takedown.reason}</p>
        )}
        <p className="mt-2 text-xs text-muted">
          It can&apos;t be published or hidden until it&apos;s restored. You can still edit it.
        </p>
      </div>
    </div>
  );
}
