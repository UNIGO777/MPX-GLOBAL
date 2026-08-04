import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { XIcon } from './icons.jsx';

/** Right-side panel (the Employees add/edit surface). Esc + overlay close. */
export function Drawer({ open, onClose, title, subtitle, children, footer }) {
  const panelRef = useRef(null);

  // `onClose` is an inline arrow at every call site, so it is a NEW function on
  // every parent render. Keeping it in the dependency array re-ran this effect
  // on each keystroke — the cleanup restored focus to the previously-focused
  // element and the re-run called panelRef.focus(), yanking the caret out of
  // whatever field was being typed into. Hold it in a ref and depend on `open`
  // alone, so the focus/scroll-lock setup happens once per opening.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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
          <div>
            {title && <h2 className="text-lg font-semibold text-ink-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
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
          <div className="flex justify-end gap-3 border-t border-surface-border px-6 py-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
