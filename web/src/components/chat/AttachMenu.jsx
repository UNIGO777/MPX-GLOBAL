import { useEffect, useRef, useState } from 'react';

import { DocIcon, ImageIcon, PlusIcon, QuoteIcon } from '../ui/icons.jsx';
import { CHAT_FILE_MAX_MB, DOCUMENT_ACCEPT, IMAGE_ACCEPT } from '../../lib/chatFiles.js';

/**
 * The composer's one "+" — Photo or Document (owner, 2026-09-24: three loose
 * icons read as cheap). Each option is a <label> for its hidden file input, so
 * the native picker opens from a real user gesture and keyboard users get it
 * for free. `accept` only filters the picker; the server sniffs real bytes.
 *
 * Options render only for what the parent handles — an option that opens a
 * picker and then goes nowhere is the dead control `web-ui-notes.md` forbids.
 *
 * 🔴 `onMakeQuotation` (Module 4, month 2) follows the same rule and is passed
 * ONLY for the exporter side. It is not a file picker, so it is a <button>
 * rather than a <label>, and it sits under a divider — attaching a file and
 * drafting a commercial document are not the same kind of action, and a menu
 * that lists them identically invites the wrong one.
 */
export function AttachMenu({ onPickImage, onPickDocument, onMakeQuotation, disabled = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!onPickImage && !onPickDocument && !onMakeQuotation) return null;

  // Reset the input first: picking the SAME file twice fires no change event
  // otherwise, so a retry after a failed send would do nothing.
  const fileInput = (id, accept, onPick) => (
    <input
      id={id}
      type="file"
      accept={accept}
      className="sr-only"
      tabIndex={-1}
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        setOpen(false);
        if (file) onPick(file);
      }}
    />
  );

  const option = (htmlFor, Icon, title, detail) => (
    <label
      htmlFor={htmlFor}
      className="flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-ink-50"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-ink-900">{title}</span>
        <span className="block text-[11.5px] text-muted">{detail}</span>
      </span>
    </label>
  );

  return (
    <span ref={wrapRef} className="relative flex h-9 w-9 shrink-0 items-center justify-center">
      {onPickImage && fileInput('chat-image', IMAGE_ACCEPT, onPickImage)}
      {onPickDocument && fileInput('chat-document', DOCUMENT_ACCEPT, onPickDocument)}

      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Attach"
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? 'bg-primary-50 text-primary-700' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900'
        }`}
      >
        <PlusIcon className={`h-5 w-5 transition-transform duration-150 motion-reduce:transition-none ${open ? 'rotate-45' : ''}`} />
        <span className="sr-only">{onMakeQuotation ? 'Attach a file or make a quotation' : 'Attach a photo or document'}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Attach"
          className="absolute bottom-full left-0 z-30 mb-2 w-64 rounded-2xl bg-white p-1.5 shadow-[0_10px_30px_rgba(0,5,23,0.14)] ring-1 ring-surface-border"
        >
          {onPickImage && option('chat-image', ImageIcon, 'Photo', 'JPG, PNG, WEBP or GIF')}
          {onPickDocument &&
            option('chat-document', DocIcon, 'Document', `PDF, Word or Excel · up to ${CHAT_FILE_MAX_MB} MB`)}

          {onMakeQuotation && (
            <>
              {(onPickImage || onPickDocument) && (
                <span aria-hidden="true" className="my-1.5 block border-t border-surface-border" />
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onMakeQuotation();
                }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-ink-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-white">
                  <QuoteIcon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink-900">Make quotation</span>
                  <span className="block text-[11.5px] text-muted">Priced offer for this product</span>
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </span>
  );
}
