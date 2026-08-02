import { KYC_STATUS_META } from '../../lib/format.js';

/**
 * The one status chip (§1.2 of the design doc). Colour never carries meaning
 * alone — every chip pairs a tone with its word. `status` is a raw kycStatus;
 * the chip renders the shared vocabulary, never the raw value.
 */
const TONES = {
  muted: 'bg-ink-100 text-ink-600',
  warning: 'bg-amber-50 text-warning',
  success: 'bg-emerald-50 text-success',
  danger: 'bg-red-50 text-danger',
};

export function StatusChip({ status, label, tone }) {
  const meta = status ? KYC_STATUS_META[status] : null;
  const text = label ?? meta?.label ?? '—';
  const chipTone = tone ?? meta?.tone ?? 'muted';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[chipTone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {text}
    </span>
  );
}
