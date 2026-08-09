import { formatMonth } from '../../lib/format.js';
import { CheckCircleIcon } from './icons.jsx';

/**
 * THE verified tick (§1.1 — the single most important convention). Rendered
 * only when verified; absence is the whole "not verified" signal. There is no
 * red-cross / warning counterpart anywhere, ever.
 */
export function VerifiedTick({ verified, verifiedAt, compact = false, className = '' }) {
  if (!verified) return null;

  // Card variant (M2): the design puts a bare check beside the seller name —
  // there is no room for the word. The label moves to screen-reader text rather
  // than being dropped, so the meaning never rests on the colour alone.
  if (compact) {
    return (
      <span className={`inline-flex shrink-0 text-success ${className}`}>
        <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Verified seller</span>
      </span>
    );
  }

  const since = formatMonth(verifiedAt);
  return (
    <span className={`inline-flex items-center gap-1.5 text-success ${className}`}>
      <CheckCircleIcon className="h-5 w-5" />
      <span className="text-sm font-semibold">Verified</span>
      {since && <span className="text-xs font-normal text-muted">since {since}</span>}
    </span>
  );
}
