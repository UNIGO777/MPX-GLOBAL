import { AlertIcon } from './icons.jsx';
import { Button } from './Button.jsx';

/**
 * Designed error state carrying the server's `requestId` as a support
 * reference — the identifier a user can actually quote (it keys the
 * server-side error log).
 */
export function ErrorState({
  title = "We couldn't load this",
  message = 'Something went wrong at our end. Try again, and if it keeps happening send this reference to support.',
  requestId,
  onRetry,
  icon: Icon = AlertIcon,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center px-6 py-12 text-center ${className}`}>
      {/* Design draws the glyph bare in danger red — no medallion. */}
      <div className="mb-4 text-danger">
        <Icon className="h-9 w-9" />
      </div>
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted">{message}</p>
      {requestId && (
        <code className="mt-3 rounded-md bg-ink-100 px-2.5 py-1 font-mono text-xs text-ink-600">
          {requestId}
        </code>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
