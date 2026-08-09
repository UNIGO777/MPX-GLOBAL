import { InfoIcon } from '../ui/icons.jsx';

/**
 * The D1/A15 cap meter — live listings and drafts, for UNVERIFIED sellers only.
 *
 * 🔴 Renders NOTHING when `caps.verified` is true. A verified account has no cap
 * and must see no cap UI at all; the server sends `{ verified: true }` with no
 * numbers precisely so a client cannot render one.
 *
 * 🔴 `caps.active.used` DELIBERATELY DISAGREES WITH the "Live" tab count. The cap
 * query excludes taken-down products (§A10 — a block frees a slot); the tab
 * counts every product holding that status. "2 of 3 live" beside a Live tab
 * showing 3 rows is CORRECT and required: a blocked listing must visibly not
 * consume a slot. Both numbers come from the same `/products/mine` response, so
 * they cannot drift — do not "fix" one to match the other.
 *
 * Tone is incentive, never scolding (design brief §1.3).
 */
function Bar({ label, used, limit, fill }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="w-48">
      <p className="mb-1 text-xs font-medium text-ink-600">
        {used} of {limit} {label}
      </p>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${used} of ${limit} ${label}`}
      >
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CapMeter({ caps }) {
  if (!caps || caps.verified) return null;

  return (
    <div>
      <div className="flex flex-wrap gap-6">
        <Bar label="live listings" used={caps.active.used} limit={caps.active.limit} fill="bg-primary-600" />
        <Bar label="drafts" used={caps.drafts.used} limit={caps.drafts.limit} fill="bg-ink-400" />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
        <InfoIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Get verified to publish unlimited products.
      </p>
    </div>
  );
}
