import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { XIcon } from './icons.jsx';

/** Right-side panel (the Employees add/edit surface). Esc + overlay close. */
export function Drawer({ open, onClose, title, subtitle, icon: Icon, children, footer }) {
  const panelRef = useRef(null);

  // `onClose` is an inline arrow at every call site, so it is a NEW function on
  // every parent render. Keeping it in the dependency array re-ran this effect
  // on each keystroke — the cleanup restored focus to the previously-focused
  // element and the re-run called panelRef.focus(), yanking the caret out of
  // whatever field was being typed into. Hold it in a ref and depend on `open`
  // alone, so the focus/scroll-lock setup happens once per opening.
  const onCloseRef = useRef(onClose);
  // Written in an effect, not during render: mutating a ref while rendering is
  // unsafe under concurrent rendering (a render can be thrown away, leaving the
  // ref pointing at a handler from an abandoned attempt).
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    panelRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onCloseRef.current?.();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink-900/40" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-card outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-surface-border px-6 py-5">
          {/* Optional icon tile — a drawer that creates or changes something
              important (a staff account, its access) gets a stronger header. */}
          <div className="flex min-w-0 items-start gap-3.5">
            {Icon && (
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 ring-1 ring-primary-100"
              >
                <Icon className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className={`${Icon ? 'text-xl font-bold' : 'text-lg font-semibold'} leading-tight text-ink-900`}>
                  {title}
                </h2>
              )}
              {subtitle && <p className={`${Icon ? 'mt-1' : 'mt-0.5'} text-sm leading-snug text-muted`}>{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-full p-1 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          // Same phone rules as Modal's footer: labels never wrap; buttons wrap
          // to a new row when needed and grow to fill it.
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-surface-border px-4 py-3 sm:gap-3 sm:px-6 sm:py-4 [&>a]:whitespace-nowrap [&>button]:whitespace-nowrap max-sm:[&>a]:grow max-sm:[&>button]:grow">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * A drawer footer with a status hint and its buttons (owner, 2026-09-25: on a
 * phone the hint, Cancel and the primary button were squeezed into one row and
 * "Send ticket" broke onto two lines).
 *
 * Phones: the hint gets its own line, then the buttons side by side at equal
 * width. From `sm`: one row — hint left, buttons right. Labels never wrap.
 */
export function DrawerActions({ hint, children }) {
  return (
    <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
      {hint && (
        <p className="text-[12.5px] font-medium text-muted sm:mr-auto" aria-live="polite">
          {hint}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:ml-auto sm:flex sm:gap-3 [&>*]:whitespace-nowrap">{children}</div>
    </div>
  );
}
