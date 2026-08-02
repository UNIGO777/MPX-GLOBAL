/**
 * The A21 portal choice — two equal segments, neither an afterthought. The
 * same email may hold one buyer AND one exporter account, so this picks which
 * one signs in / resets; it is a required field on every party auth call.
 */
const PORTALS = [
  { value: 'buyer', label: 'Buyer' },
  { value: 'exporter', label: 'Exporter' },
];

export function PortalToggle({ value, onChange, disabled }) {
  return (
    <div
      role="radiogroup"
      aria-label="Account type"
      className="grid grid-cols-2 gap-1 rounded-full border border-surface-border bg-ink-50 p-1"
    >
      {PORTALS.map((p) => (
        <button
          key={p.value}
          type="button"
          role="radio"
          aria-checked={value === p.value}
          disabled={disabled}
          onClick={() => onChange(p.value)}
          className={`h-9 rounded-full text-sm font-semibold transition-colors ${
            value === p.value
              ? 'bg-primary-800 text-white shadow-sm'
              : 'text-ink-600 hover:text-ink-900'
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
