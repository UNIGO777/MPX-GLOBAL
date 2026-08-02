import { useId } from 'react';

/** Checkbox with label + optional help line (the permissions-list shape). */
export function Checkbox({ label, help, checked, onChange, disabled }) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
        checked ? 'border-primary-600 bg-primary-50' : 'border-surface-border bg-white hover:bg-ink-50'
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 rounded border-surface-border text-primary-600 focus:ring-primary-600"
      />
      <span>
        <span className="block text-sm font-medium text-ink-900">{label}</span>
        {help && <span className="block text-xs text-muted">{help}</span>}
      </span>
    </label>
  );
}
