import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { XIcon } from './icons.jsx';

/**
 * Centred modal: overlay click + Esc close, focus moves in on open and is
 * kept inside (simple trap), body scroll locked while open.
 */
export function Modal({ open, onClose, title, children, footer, danger = false }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    panelRef.current?.focus();
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
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
  }, [open, onClose]);

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
        className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-card outline-none"
      >
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
      </div>
    </div>,
    document.body,
  );
}
