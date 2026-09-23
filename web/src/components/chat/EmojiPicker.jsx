import { useEffect, useRef, useState } from 'react';

import { SmileIcon } from '../ui/icons.jsx';

/**
 * The composer's emoji button + panel (owner, 2026-09-24).
 *
 * A short, curated set rather than a picker library: this is a B2B trade chat,
 * the full Unicode catalogue is thousands of glyphs nobody here needs, and a
 * library would be a new dependency (CLAUDE.md). Anything not listed can still
 * be typed from the device keyboard — the server stores emoji as plain text.
 *
 * Deliberately absent: phone / envelope / link glyphs. Contact details are
 * hidden by design on this platform, and a panel that offers 📞 invites the
 * exchange the product is built to route through enquiries.
 *
 * The panel stays open after a pick so several can be added in a row; Esc or a
 * click outside closes it and hands focus back.
 */
const EMOJI = [
  ['🙂', 'Slight smile'],
  ['😊', 'Smiling'],
  ['😀', 'Grinning'],
  ['😄', 'Laughing'],
  ['😉', 'Wink'],
  ['😅', 'Relieved'],
  ['🤔', 'Thinking'],
  ['😮', 'Surprised'],
  ['😢', 'Sad'],
  ['👋', 'Wave'],
  ['👍', 'Thumbs up'],
  ['👌', 'OK'],
  ['🙏', 'Thank you'],
  ['🤝', 'Handshake'],
  ['👏', 'Clapping'],
  ['🙌', 'Celebrate'],
  ['💪', 'Strong'],
  ['👀', 'Looking'],
  ['✅', 'Done'],
  ['❌', 'No'],
  ['⭐', 'Star'],
  ['🔥', 'Hot'],
  ['🎉', 'Party'],
  ['💯', 'Hundred'],
  ['📦', 'Package'],
  ['🚚', 'Truck'],
  ['🚢', 'Ship'],
  ['✈️', 'Air freight'],
  ['🏭', 'Factory'],
  ['📄', 'Document'],
  ['📷', 'Photo'],
  ['📅', 'Date'],
  ['⏰', 'Deadline'],
  ['⌛', 'Waiting'],
  ['💰', 'Price'],
  ['📈', 'Growth'],
  ['🌍', 'Global'],
  ['🔍', 'Checking'],
  ['💡', 'Idea'],
  ['❤️', 'Heart'],
];

export function EmojiPicker({ onPick, canFit, compact = false, disabled = false, align = 'right' }) {
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

  return (
    /* Same h-8 box as the composer's other tools (it always passes `compact`
       now) — a different box reads as a different size beside them. */
    <span
      ref={wrapRef}
      className={`relative flex shrink-0 items-center justify-center ${compact ? 'h-8 w-8' : 'h-11 w-11'}`}
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Add an emoji"
        className={`flex items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? 'bg-primary-50 text-primary-700' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900'
        } ${compact ? 'h-8 w-8' : 'h-9 w-9'}`}
      >
        <SmileIcon className="h-[18px] w-[18px]" />
        <span className="sr-only">Add an emoji</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Emoji"
          className={`absolute bottom-full z-30 mb-2 ${align === 'left' ? 'left-0' : 'right-0'} w-[min(18rem,calc(100vw-2rem))] rounded-2xl bg-white p-2 shadow-[0_10px_30px_rgba(0,5,23,0.14)] ring-1 ring-surface-border`}
        >
          <div className="grid grid-cols-8 gap-0.5">
            {EMOJI.map(([char, name]) => {
              const fits = canFit(char);
              return (
                <button
                  key={char}
                  type="button"
                  disabled={!fits}
                  onClick={() => onPick(char)}
                  aria-label={name}
                  title={fits ? name : 'Message is at the 200-character limit'}
                  className="flex aspect-square items-center justify-center rounded-lg text-[20px] leading-none transition-colors hover:bg-ink-50 focus-visible:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  {char}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </span>
  );
}
