import { useEffect } from 'react';

import { Alert } from './Alert.jsx';
import { XIcon } from './icons.jsx';

/**
 * A CONFIRMATION that goes away — "Saved.", "Warning sent.", "A new code was
 * sent" (owner, 2026-09-24: "the message saying warning sent is not
 * disappearing … fix this for all other such messages across the whole
 * platform"). Every one used to sit on the page until the next action, long
 * after it stopped being news.
 *
 * It has a ✕, and hides itself: 6 s for good news, 10 s for a notice that
 * explains a consequence (warning / danger tone) — long enough to read twice.
 *
 * 🔴 NOT for errors, and NOT for status notices that describe the current
 * state ("under review", "verification revoked", "can't publish"): hiding those
 * would lose information the person still needs. Those stay plain <Alert>s.
 *
 * The parent owns the message; `onDismiss` clears it. A new message restarts
 * the clock (the effect keys on `children`).
 */
export function FlashMessage({ tone = 'success', onDismiss, className = '', children }) {
  const ms = tone === 'warning' || tone === 'danger' ? 10000 : 6000;

  useEffect(() => {
    const t = setTimeout(onDismiss, ms);
    return () => clearTimeout(t);
    // `onDismiss` is usually an inline arrow — keying on it would restart the
    // clock on every parent render and the message would never go.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, ms]);

  return (
    <div className={`relative ${className}`}>
      <Alert tone={tone} className="pr-11">
        {children}
      </Alert>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss message"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
