import { useEffect, useRef, useState } from 'react';

import { ImageIcon, SendIcon, XIcon } from '../ui/icons.jsx';
import { Spinner } from '../ui/Spinner.jsx';

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
 * 🚫 No paperclip. Attachments are out of scope for month 1 (M4-14) and document
 * exchange waits for the Quotation module — an affordance that opens a file
 * picker and then refuses the file is worse than its absence.
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
  onClearImage,
}) {
  const textareaRef = useRef(null);
  const [focused, setFocused] = useState(false);

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
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_LENGTH && !sending;
  const remaining = MAX_LENGTH - value.length;
  const showRing = value.length >= RING_FROM;
  const filled = Math.min(1, Math.max(0, (value.length - RING_FROM) / (MAX_LENGTH - RING_FROM)));

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
  };

  const onKeyDown = (e) => {
    // Enter sends, Shift+Enter starts a new line — the convention every
    // messaging surface uses. IME composition must never be interrupted.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      /* A card that FLOATS on the canvas rather than a bar bolted to the bottom
         with a hairline. The elevation is what separates it from the transcript;
         the ring on focus is what says it is one control. */
      className="rounded-2xl bg-white p-1.5 shadow-[0_1px_2px_rgba(0,5,23,0.06),0_10px_24px_rgba(0,5,23,0.07)] ring-1 ring-surface-border/70 transition-shadow focus-within:ring-2 focus-within:ring-primary-600"
    >
      {/* The chosen image, before it is sent. Shown so nobody fires an 8 MB
          file at a supplier without seeing which one they picked. */}
      {image && (
        <div className="mb-1.5 flex items-center gap-2.5 rounded-xl bg-ink-50 p-2">
          <img
            src={image.previewUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg object-cover"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold text-ink-900">
              {image.file.name}
            </span>
            <span className="block text-[11px] text-muted">
              {(image.file.size / (1024 * 1024)).toFixed(1)} MB
            </span>
          </span>
          <button
            type="button"
            onClick={onClearImage}
            className="shrink-0 rounded-full p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
            aria-label="Remove image"
          >
            <XIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
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
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder ?? 'Write a message…'}
          className={`ml-2 block w-full resize-none border-0 bg-transparent p-0 leading-relaxed text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-0 ${
            compact ? 'my-1.5 text-[13px]' : 'my-2 text-[14px]'
          }`}
        />

        {/* The count survives for anyone who cannot see the ring. */}
        <span aria-live="polite" className="sr-only">
          {showRing ? `${remaining} characters remaining` : ''}
        </span>

        {/* Attach. Rendered only when the parent actually handles a file. */}
        {onPickImage && (
          <>
            <input
              id="chat-image"
              type="file"
              /* Narrowed to the four types the server's magic-byte allowlist
                 accepts. This only filters the picker — the server re-verifies
                 by real bytes regardless, because an `accept` attribute is a
                 convenience, never a control. */
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Reset first: picking the SAME file twice fires no change
                // event otherwise, so a retry after a failed send does nothing.
                e.target.value = '';
                if (file) onPickImage(file);
              }}
            />
            {/* 🔴 Wrapped in the SAME `h-11 w-11` box the send button sits in,
                and given the same inner size and icon size. Without the wrapper
                this label was a bare `h-9` flex child against a send button
                centred inside an `h-11` span — the row is `items-end`, so the
                two ended up on different baselines and read as different sizes
                even though both inner boxes were 36px. Any change to one of
                these two controls has to be made to the other. */}
            <span
              className={`flex shrink-0 items-center justify-center ${
                compact ? 'h-9 w-9' : 'h-11 w-11'
              }`}
            >
              <label
                htmlFor="chat-image"
                title="Attach an image"
                className={`flex cursor-pointer items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900 ${
                  compact ? 'h-8 w-8' : 'h-9 w-9'
                }`}
              >
                <ImageIcon className="h-[17px] w-[17px]" aria-hidden="true" />
                <span className="sr-only">Attach an image</span>
              </label>
            </span>
          </>
        )}

        <span
          className={`relative flex shrink-0 items-center justify-center ${
            compact ? 'h-9 w-9' : 'h-11 w-11'
          }`}
        >
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

          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            className={`flex items-center justify-center rounded-full bg-primary-600 text-white ${
              compact ? 'h-8 w-8' : 'h-9 w-9'
            } shadow-sm transition-all hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 active:scale-90 disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-400 disabled:shadow-none motion-reduce:active:scale-100`}
          >
            {sending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <SendIcon className="h-[17px] w-[17px]" aria-hidden="true" />
            )}
          </button>
        </span>
      </div>

      {/* Taught on focus, not printed permanently — a hint that is always on
          screen stops being read after the first day and becomes noise. */}
      <p
        className={`hidden overflow-hidden pl-2 text-[11px] text-ink-400 transition-all duration-150 motion-reduce:transition-none sm:block ${
          focused ? 'mt-0.5 max-h-4 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <kbd className="font-sans font-semibold text-ink-500">Enter</kbd> to send ·{' '}
        <kbd className="font-sans font-semibold text-ink-500">Shift + Enter</kbd> for a new line
      </p>
    </form>
  );
}
