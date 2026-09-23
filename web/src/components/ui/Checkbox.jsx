import { useEffect, useId, useRef } from 'react';

/**
 * The tick box itself — a real, focusable <input type="checkbox"> restyled with
 * `appearance-none`, so keyboard, screen-reader and form behaviour stay native
 * while the look matches the brand (the browser default was a blue square).
 *
 * `indeterminate` renders a dash — used by "Select all" when only part of a
 * group is ticked. It is a DOM property, not an attribute, hence the effect.
 */
export function CheckboxBox({ id, checked, indeterminate = false, onChange, disabled, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <span className="relative flex h-5 w-5 shrink-0">
      <input
        ref={ref}
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-ink-300 bg-white transition-colors hover:border-ink-500 checked:border-primary-600 checked:bg-primary-600 checked:hover:border-primary-700 checked:hover:bg-primary-700 indeterminate:border-primary-600 indeterminate:bg-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
        {...rest}
      />
      {/* Tick — shown only when checked and not indeterminate. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100 peer-indeterminate:!opacity-0"
      >
        <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {/* Dash — the partial state. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        fill="none"
        className="pointer-events-none absolute inset-0 m-auto h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-indeterminate:opacity-100"
      >
        <path d="M4 8h8" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Checkbox with label + optional help line (the permissions-list shape). */
export function Checkbox({ label, help, checked, onChange, disabled, plain = false }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 transition-colors ${
        plain
          ? 'py-2.5'
          : `rounded-lg border p-3 ${checked ? 'border-primary-600 bg-primary-50' : 'border-surface-border bg-white hover:bg-ink-50'}`
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <CheckboxBox id={id} checked={checked} onChange={onChange} disabled={disabled} />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-900">{label}</span>
        {help && <span className="mt-0.5 block text-xs text-muted">{help}</span>}
      </span>
    </label>
  );
}
