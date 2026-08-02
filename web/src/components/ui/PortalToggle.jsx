import { useRef } from 'react';

/**
 * The A21 portal choice — two equal segments, neither an afterthought. The
 * same email may hold one buyer AND one exporter account, so this picks which
 * one signs in / resets; it is a required field on every party auth call.
 *
 * Deliberately SHORTER than a form field (32px vs the 44px input): A21 added
 * this control after the mockups were drawn, and at input height it read as a
 * third field and pushed the whole form down the pane.
 */
const PORTALS = [
  { value: 'buyer', label: 'Buyer' },
  { value: 'exporter', label: 'Exporter' },
];

export function PortalToggle({ value, onChange, disabled }) {
  const refs = useRef({});

  // role="radio" promises arrow-key navigation and a single tab stop. Without
  // this the roles describe behaviour the widget doesn't have.
  const onKeyDown = (e) => {
    const delta = ['ArrowRight', 'ArrowDown'].includes(e.key)
      ? 1
      : ['ArrowLeft', 'ArrowUp'].includes(e.key)
        ? -1
        : 0;
    if (!delta || disabled) return;
    e.preventDefault();
    const i = PORTALS.findIndex((p) => p.value === value);
    const next = PORTALS[(i + delta + PORTALS.length) % PORTALS.length].value;
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Account type"
      onKeyDown={onKeyDown}
      className="grid grid-cols-2 gap-1 rounded-full border border-surface-border bg-ink-50 p-0.5"
    >
      {PORTALS.map((p) => (
        <button
          key={p.value}
          ref={(el) => (refs.current[p.value] = el)}
          type="button"
          role="radio"
          aria-checked={value === p.value}
          tabIndex={value === p.value ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(p.value)}
          className={`h-8 rounded-full text-[13px] font-semibold transition-colors ${
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
