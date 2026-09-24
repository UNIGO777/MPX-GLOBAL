import { useEffect, useRef } from 'react';

import { AlertIcon, SendIcon, XIcon } from '../ui/icons.jsx';
import { fileBadge, formatFileSize } from '../../lib/chatFiles.js';
import { AttachMenu } from './AttachMenu.jsx';
import { Spinner } from '../ui/Spinner.jsx';
import { EmojiPicker } from './EmojiPicker.jsx';

/**
 * The message composer.
 *
 * 🔴 The 200-character cap is a REAL server rule (M4-12), not a UI nicety —
 * `POST /conversations/:id/messages` rejects anything longer. It applies to
 * normal sends only: the composed first enquiry message and the platform's
 * system notices are exempt and routinely run past 200, which is exactly why the
 * limit lives at the route boundary and not on the model.
 *
 * ✳️ THE SIGNATURE ELEMENT — the cap is DRAWN, not counted.
 * Past 160 characters a ring closes around the send button: amber as it fills,
 * red at the limit. A number in the corner has to be read and converted; a ring
 * is seen filling while you type. It is the one distinctive thing on this
 * screen, and it earns its place because this product has a real constraint
 * worth expressing — it is not decoration. The numeric count stays for screen
 * readers, which cannot see a ring.
 *
 * Attachments: images (D9, 2026-09-23) and documents — PDF, .docx, .xlsx (D10,
 * 2026-09-24, a scope override of M4-14). Each button renders only when the
 * parent handles that kind of file.
 */
const MAX_LENGTH = 200;
const RING_FROM = 160;
const MAX_HEIGHT = 120;

// 2πr for r=20 — the ring's circumference, which drives the dash offset.
const RING_LENGTH = 125.66;

export function Composer({
  value,
  onChange,
  onSend,
  sending,
  autoFocus = false,
  placeholder,
  compact = false,
  // D9 · image attachments (2026-09-23). Optional: the composer is also used
  // where attaching makes no sense, and an attach button with nowhere to send
  // is exactly the dead control `web-ui-notes.md` forbids.
  image = null,
  onPickImage,
  onPickDocument,
  onMakeQuotation,
  onClearImage,
  attachError = null,
}) {
  const textareaRef = useRef(null);

  /**
   * Grow with the text, up to a ceiling — past that the box scrolls rather than
   * eating the transcript above it.
   *
   * 🔴 `rows` is pinned at 1 and the height is driven ONLY by this measurement.
   * It used to also track a `rows` state that flipped to 2 for tall content —
   * but `rows` sets a MINIMUM height, so after sending a long message the reset
   * to `height:auto` still measured two lines and the box never shrank back.
   */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, MAX_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, [value]);

  const trimmed = value.trim();
  // A queued file can go on its own — the text is optional then (owner,
  // 2026-09-24; it used to be required with every attachment).
  const canSend = (trimmed.length > 0 || Boolean(image)) && trimmed.length <= MAX_LENGTH && !sending;
  const remaining = MAX_LENGTH - value.length;
  const showRing = value.length >= RING_FROM;
  const filled = Math.min(1, Math.max(0, (value.length - RING_FROM) / (MAX_LENGTH - RING_FROM)));

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
  };

  /**
   * Insert at the caret (replacing any selection), not at the end — and only if
   * the result still fits. Emoji are 2+ UTF-16 units; the server's cap counts
   * `.length` the same way, so a check here is the same check it makes.
   */
  const fitsAtCaret = (text) => {
    const el = textareaRef.current;
    const selected = el ? el.selectionEnd - el.selectionStart : 0;
    return value.length - selected + text.length <= MAX_LENGTH;
  };
  const insertAtCaret = (text) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    if (next.length > MAX_LENGTH) return;
    onChange(next);
    const caret = start + text.length;
    // After React commits the new value — setting it now would be overwritten.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const onKeyDown = (e) => {
    // Enter sends, Shift+Enter starts a new line — the convention every
    // messaging surface uses. IME composition must never be interrupted.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  // ✳️ The ring (see the header note) closes around the send button.
  const sendButton = (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      {showRing && (
        <svg viewBox="0 0 44 44" aria-hidden="true" className="absolute inset-0 -rotate-90">
          <circle cx="22" cy="22" r="20" fill="none" strokeWidth="2" className="stroke-ink-200" />
          <circle
            cx="22"
            cy="22"
            r="20"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - filled)}
            className={`transition-[stroke-dashoffset] duration-150 motion-reduce:transition-none ${
              remaining <= 0 ? 'stroke-danger' : 'stroke-warning-500'
            }`}
          />
        </svg>
      )}
      {/* Empty = the same button, dimmed — not swapped for a grey disc, which
          read as broken rather than waiting (owner, 2026-09-24). */}
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Send message"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white shadow-sm transition-all hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 active:scale-90 disabled:cursor-not-allowed disabled:opacity-35 disabled:shadow-none disabled:hover:bg-primary-600 motion-reduce:active:scale-100"
      >
        {sending ? <Spinner className="h-4 w-4" /> : <SendIcon className="h-4 w-4 -translate-x-px translate-y-px" aria-hidden="true" />}
      </button>
    </span>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      /* Redesigned 2026-09-24 (owner: "looking cheap", then "still not good").
         ONE row, the layout working chat tools use: attach on the left, the
         message in the middle, emoji and send on the right (owner, 2026-09-24). The three loose icons
         became one "+" menu; the always-on keyboard hint is gone. Focus is a
         soft halo on a darker border, not a 2px brand-red ring. */
      className="rounded-[22px] border border-surface-border bg-white shadow-[0_1px_2px_rgba(0,5,23,0.04),0_6px_16px_rgba(0,5,23,0.05)] transition-[border-color,box-shadow] focus-within:border-ink-300 focus-within:shadow-[0_0_0_4px_rgba(0,5,23,0.05),0_6px_16px_rgba(0,5,23,0.06)]"
    >
      {/* The chosen file, before it is sent — so nobody fires an 8 MB file at a
          supplier without seeing which one they picked. */}
      {image && (
        <div className="mx-2 mt-2 flex items-center gap-2.5 rounded-2xl border border-surface-border bg-ink-50/60 p-2">
          {image.previewUrl ? (
            <img src={image.previewUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-[10px] font-bold tracking-wide text-primary-700 ring-1 ring-primary-100"
            >
              {fileBadge(image.file.name)}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold text-ink-900">{image.file.name}</span>
            <span className="block text-[11px] text-muted">{formatFileSize(image.file.size)}</span>
          </span>
          <button
            type="button"
            onClick={onClearImage}
            className="shrink-0 rounded-full p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
            aria-label={image.previewUrl ? 'Remove image' : 'Remove file'}
          >
            <XIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* A file refused before upload — said here, next to the control that
          picked it, rather than as a "Not sent" after an 8 MB round-trip. */}
      {attachError && (
        <p role="alert" className="flex items-center gap-1.5 px-4 pt-2 text-[12px] font-medium text-danger">
          <AlertIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {attachError}
        </p>
      )}

      {/* items-end: as the text grows, the controls stay on its last line. */}
      <div className={`flex items-end ${compact ? 'p-1' : 'p-1.5'}`}>
        <span className="flex h-10 items-center">
          <AttachMenu
            onPickImage={onPickImage}
            onPickDocument={onPickDocument}
            onMakeQuotation={onMakeQuotation}
            disabled={sending}
          />
        </span>

        <label htmlFor="chat-composer" className="sr-only">
          Write a message
        </label>
        <textarea
          id="chat-composer"
          ref={textareaRef}
          value={value}
          rows={1}
          autoFocus={autoFocus}
          maxLength={MAX_LENGTH}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={image ? 'Add a message (optional)…' : placeholder ?? 'Write a message…'}
          className={`ml-1.5 mr-1 block min-w-0 flex-1 resize-none border-0 bg-transparent px-0 py-[9px] leading-[22px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-0 ${
            compact ? 'text-[13px]' : 'text-[14.5px]'
          }`}
        />
        {/* The count survives for anyone who cannot see the ring. */}
        <span aria-live="polite" className="sr-only">
          {showRing ? `${remaining} characters remaining` : ''}
        </span>

        <span className="flex h-10 items-center">
          {/* `compact` = the h-8 box. Without it the picker kept its old 44px
              wrapper around a 32px button — dead space either side that was
              plain to see on a phone (owner, 2026-09-24). */}
          <EmojiPicker onPick={insertAtCaret} canFit={fitsAtCaret} compact align="right" disabled={sending} />
        </span>

        {sendButton}
      </div>
    </form>
  );
}
