import { KYC_STATUS_META } from '../../lib/format.js';

/**
 * The one status chip (§1.2 of the design doc). Colour never carries meaning
 * alone — every chip pairs a tone with its word. `status` is a raw kycStatus;
 * the chip renders the shared vocabulary, never the raw value.
 */
// Mockup chip: tint fill + same-hue text, #F2F4F7/#667085 for the neutral one.
// All four now use semantic tokens rather than raw palette shades.
const TONES = {
  muted: 'bg-ink-100 text-ink-500',
  warning: 'bg-warning-50 text-warning',
  success: 'bg-success-50 text-success',
  danger: 'bg-danger-50 text-danger',
};

export function StatusChip({ status, label, tone }) {
  const meta = status ? KYC_STATUS_META[status] : null;
  const text = label ?? meta?.label ?? '—';
  const chipTone = tone ?? meta?.tone ?? 'muted';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold ${TONES[chipTone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {text}
    </span>
  );
}
