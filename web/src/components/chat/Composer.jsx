import { useEffect, useRef, useState } from 'react';

import { SendIcon } from '../ui/icons.jsx';
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

export function Composer({ value, onChange, onSend, sending, autoFocus = false, placeholder, compact = false }) {
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
