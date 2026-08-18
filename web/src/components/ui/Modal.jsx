import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { XIcon } from './icons.jsx';

/**
 * Centred modal: overlay click + Esc close, focus moves in on open and is
 * kept inside (simple trap), body scroll locked while open.
 */
/**
 * `centered` is the design's confirm-dialog shape: an icon medallion, centred
 * title and body, centred buttons and NO close ✕ (the two buttons are the only
 * way out). Used by the destructive confirms; the default left-aligned shape
 * stays for form dialogs.
 */
export function Modal({ open, onClose, title, children, footer, danger = false, centered = false, icon: Icon }) {
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

    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();
      if (e.key === 'Tab') {
        // Keep focus inside the dialog.
        const focusables = panelRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables?.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-900/40"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={`relative w-full bg-white shadow-card outline-none ${
          centered ? 'max-w-[480px] rounded-2xl p-8 text-center' : 'max-w-md rounded-lg p-6'
        }`}
      >
        {centered ? (
          <>
            {Icon && (
              <span
                aria-hidden="true"
                className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full ${
                  danger ? 'bg-danger-50 text-danger' : 'bg-primary-50 text-primary-600'
                }`}
              >
                <Icon className="h-7 w-7" />
              </span>
            )}
            {title && <h2 className="text-xl font-bold text-ink-900">{title}</h2>}
            <div className="mt-3 text-[15px] leading-relaxed text-muted">{children}</div>
            {footer && <div className="mt-8 flex justify-center gap-3">{footer}</div>}
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              {title && (
                <h2 className={`text-lg font-semibold ${danger ? 'text-danger' : 'text-ink-900'}`}>{title}</h2>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="rounded-full p-1 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3">{children}</div>
            {footer && <div className="mt-6 flex justify-end gap-3">{footer}</div>}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
