import { useEffect } from 'react';
import { createPortal } from 'react-dom';

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from './icons.jsx';


/**
 * 🔴 EXTRACTED from `pages/public/ProductDetail.jsx` on 2026-09-23, when chat
 * images needed the same thing. Copying it would have meant two lightboxes, and
 * the second would have shipped without the portal below — a fix that cost a
 * real debugging session once already (read its note). One modal, both callers.
 *
 * Single-image callers pass `images={[url]}`, `active={0}` and a no-op
 * `onNavigate`; every prev/next affordance is already conditional on there
 * being more than one.
 */
/**
 * Fullscreen image view. A real
 * modal (web-design.md: "modals trap focus and close on Esc"), not a bare
 * `<img>` swapped to `position: fixed` — focus moves to the close button on
 * open and back to whatever triggered it on close, Tab cycles only within
 * the modal's own controls, Escape and a backdrop click both close it.
 */
export function Lightbox({ images, active, name, onNavigate, onClose }) {
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = 'hidden';

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && images.length > 1) {
        onNavigate((active + 1) % images.length);
      } else if (e.key === 'ArrowLeft' && images.length > 1) {
        onNavigate((active - 1 + images.length) % images.length);
      } else if (e.key === 'Tab') {
        // Lightweight focus trap — the modal only ever has 1-3 buttons
        // (close, and prev/next when there's more than one image).
        const focusable = document.querySelectorAll('[data-lightbox] button');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    document.querySelector('[data-lightbox-close]')?.focus();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Portalled to `document.body` (2026-08-12 bugfix, found while testing this
  // exact modal) — rendered in place, this modal's `fixed` + `z-50` was
  // trapped inside the gallery's own `sticky` wrapper (added earlier for the
  // dead-space fix), which unconditionally opens its own stacking context.
  // The header's `z-40` then painted OVER the modal despite the lower
  // number, because the two were never actually competing in the same
  // stacking context — the close button rendered correctly but was
  // genuinely unclickable. A portal escapes every ancestor's stacking
  // context, so z-50 now competes for real at the document root.
  return createPortal(
    <div
      data-lightbox
      role="dialog"
      aria-modal="true"
      aria-label={`${name} — full-size image`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/90 p-6"
      onClick={onClose}
    >
      <button
        type="button"
        data-lightbox-close
        onClick={onClose}
        aria-label="Close full-size image"
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <XIcon className="h-5 w-5" aria-hidden="true" />
      </button>

      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((active - 1 + images.length) % images.length);
          }}
          aria-label="Previous image"
          className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <ChevronLeftIcon className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      <img
        src={images[active]}
        alt={name}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
      />

      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate((active + 1) % images.length);
          }}
          aria-label="Next image"
          className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <ChevronRightIcon className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      {images.length > 1 && (
        <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-sm font-medium text-white/80">
          {active + 1} / {images.length}
        </p>
      )}
    </div>,
    document.body,
  );
}
