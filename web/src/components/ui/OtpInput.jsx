import { useRef } from 'react';

/**
 * 6 separate boxes, auto-advance, paste-across, backspace-steps-back. Numeric
 * keypad semantics. Value is a plain string ('' … 6 digits); `onComplete`
 * fires once when the sixth digit lands (auto-submit is fine, but callers keep
 * a visible button too — accessibility).
 */
export function OtpInput({ length = 6, value, onChange, onComplete, disabled, error, autoFocus }) {
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
    <div className="flex gap-2" role="group" aria-label="Verification code">
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
            // Mockup boxes are 56×56. Focus is ONE treatment: a 2px accent
            // border, no ring and no offset halo (owner, 2026-08-03) — the same
            // convention every other field follows. The border IS the visible
            // focus indicator, so outline-none still has a replacement.
            'h-14 w-12 rounded-lg border text-center text-2xl font-bold tabular-nums transition-all sm:w-14',
            'focus:outline-none focus:border-2 focus:border-primary-600',
            'disabled:bg-ink-100 disabled:text-ink-500 disabled:cursor-not-allowed',
            error ? 'border-danger bg-danger-50' : 'border-surface-border bg-white',
          ].join(' ')}
        />
      ))}
    </div>
  );
}
