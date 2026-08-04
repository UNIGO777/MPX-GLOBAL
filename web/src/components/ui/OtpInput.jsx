import { useRef } from 'react';

/**
 * 6 separate boxes, auto-advance, paste-across, backspace-steps-back. Numeric
 * keypad semantics. Value is a plain string ('' … 6 digits); `onComplete`
 * fires once when the sixth digit lands (auto-submit is fine, but callers keep
 * a visible button too — accessibility).
 */
export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  disabled,
  error,
  autoFocus,
  // Must match the VISIBLE label above the boxes: a screen reader announcing
  // "Verification code" while the page reads "Reset code" is two different
  // names for one control.
  label = 'Verification code',
}) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const commit = (next) => {
    const clean = next.slice(0, length);
    onChange(clean);
    if (clean.length === length && !next.includes(' ')) onComplete?.(clean);
  };

  const handleChange = (index, raw) => {
    const entered = raw.replace(/\D/g, '');
    if (!entered) return;
    // Typing (1 char) and paste (many) share one path: overwrite from `index`.
    const next = (value.slice(0, index) + entered).slice(0, length);
    commit(next);
    refs.current[Math.min(next.length, length - 1)]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const cut = index > 0 && !digits[index] ? index - 1 : index;
      onChange(value.slice(0, cut));
      refs.current[cut]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  return (
    <div className="flex w-full gap-2" role="group" aria-label={label}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          // The code box is the only thing to do on this screen — land in it.
          autoFocus={autoFocus && i === 0}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length} // room for a full paste into any box
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={[
            // Mockup boxes are 56×56 — but FLUID, not fixed. The auth card is
            // max-w-[400px] with p-8 until lg, leaving 336px inside, so six
            // fixed 56px boxes plus gaps (376px) spilled out of the card
            // between 640–900px, and the 48px variant spilled on a 390px
            // phone. flex-1 lets them shrink to fit any container; the cap
            // keeps the design's 56px wherever there is room.
            'h-14 min-w-0 flex-1 basis-0 max-w-[56px] rounded-lg border text-center text-2xl font-bold tabular-nums transition-all',
            'focus:outline-none focus:border-2 focus:border-primary-600',
            'disabled:bg-ink-100 disabled:text-ink-500 disabled:cursor-not-allowed',
            error ? 'border-danger bg-danger-50' : 'border-surface-border bg-white',
          ].join(' ')}
        />
      ))}
    </div>
  );
}
