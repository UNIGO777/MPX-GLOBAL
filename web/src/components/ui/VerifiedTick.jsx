import { formatMonth } from '../../lib/format.js';
import { CheckCircleIcon } from './icons.jsx';

/**
 * THE verified tick (§1.1 — the single most important convention). Rendered
 * only when verified; absence is the whole "not verified" signal. There is no
 * red-cross / warning counterpart anywhere, ever.
 */
export function VerifiedTick({ verified, verifiedAt, className = '' }) {
  if (!verified) return null;
  const since = formatMonth(verifiedAt);
  return (
    <span className={`inline-flex items-center gap-1.5 text-success ${className}`}>
      <CheckCircleIcon className="h-5 w-5" />
      <span className="text-sm font-semibold">Verified</span>
      {since && <span className="text-xs font-normal text-muted">since {since}</span>}
    </span>
  );
}
