import { Spinner } from './Spinner.jsx';

/**
 * Pill buttons per the Precision spec: primary = accent fill, secondary = navy
 * outline, ghost = text-only, danger = destructive. Every variant carries
 * loading + disabled states; loading keeps the label visible next to the
 * spinner so the button width doesn't jump.
 */
// Disabled is the mockups' GREY (#C5C6CF fill, #667085 text) on every filled
// variant — a washed-out blue reads as a live button that ignores clicks (the
// systemic activation-drift found 2026-08-01). Filled variants carry the
// mockups' accent-tinted shadow and `active:scale-[0.98]` press feedback.
const VARIANTS = {
  primary:
    'bg-primary-600 text-white shadow-lg shadow-primary-600/20 hover:bg-primary-700 disabled:bg-ink-300 disabled:text-ink-500 disabled:shadow-none',
  secondary:
    'border border-primary-800 text-primary-800 bg-transparent hover:bg-primary-50 disabled:border-ink-300 disabled:text-ink-400',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 disabled:text-ink-400',
  danger:
    'bg-danger text-white shadow-lg shadow-danger/20 hover:bg-red-700 disabled:bg-ink-300 disabled:text-ink-500 disabled:shadow-none',
  dangerOutline:
    'border border-danger text-danger bg-transparent hover:bg-red-50 disabled:border-ink-300 disabled:text-ink-400',
};

// md = the mockups' standard form CTA: 48px pill, 16px semibold label.
const SIZES = {
  md: 'h-12 px-6 text-base',
  sm: 'h-9 px-4 text-sm',
  lg: 'h-12 px-8 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  fullWidth = false,
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all',
        'active:enabled:scale-[0.98] disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" light={variant === 'primary' || variant === 'danger'} />}
      {children}
    </button>
  );
}
