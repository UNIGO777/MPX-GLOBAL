import { useId } from 'react';

/**
 * The label + control + helper/error wrapper every form field shares. A real
 * <label> is wired to the control via id (a11y is "done", not polish), the
 * error line replaces the helper, and `optional` renders the quiet "Optional"
 * marker the mockups use instead of asterisks-on-required.
 */
export function Field({ label, helper, error, optional = false, trailing, children }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-baseline justify-between">
          <label htmlFor={id} className="text-sm font-medium text-ink-900">
            {label}
            {optional && <span className="ml-2 text-xs font-normal text-muted">Optional</span>}
          </label>
          {trailing}
        </div>
      )}
      {typeof children === 'function' ? children(id, Boolean(error)) : children}
      {error ? (
        <p className="text-sm text-danger" role="alert">{error}</p>
      ) : (
        helper && <p className="text-xs text-muted">{helper}</p>
      )}
    </div>
  );
}

/**
 * Shared input classes so every control matches the DESIGN.md spec: 44px tall,
 * 8px radius, 16px horizontal padding, 1px #C5C6CF border; focus = accent
 * border + soft accent glow (the buyer-registration mockup's
 * `ring-mpx-glow/20`), NEVER an offset halo; disabled = the mockups' grey fill;
 * error = red border + pale red tint. This is the dominant spec across the M1
 * mockups: `w-full h-[44px] px-4 rounded-[8px] border-[#C5C6CF]`.
 */
export function inputClasses(hasError, extra = '') {
  return [
    'h-11 w-full rounded-lg border px-4 text-sm text-ink-900 placeholder:text-ink-500 transition-all',
    'focus:outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20',
    'disabled:bg-ink-100 disabled:text-ink-500 disabled:cursor-not-allowed',
    hasError ? 'border-danger bg-danger-50' : 'border-surface-border bg-white',
    extra,
  ].join(' ');
}
