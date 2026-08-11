/**
 * The one on/off switch (2026-08-11, M2 redesign). Extracted from the category
 * manager's inline toggle so every on/off control looks and behaves the same.
 *
 * `label` is REQUIRED — a bare switch announces nothing. `busy` dims and locks
 * it during the round trip so a slow network can't double-fire.
 */
export function Switch({ checked, onChange, disabled = false, busy = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-primary-600' : 'bg-ink-300'
      } ${busy ? 'opacity-60' : ''} disabled:cursor-not-allowed`}
    >
      {/* Anchored with left-0.5, not translate-from-static-position: a button
          centres inline content, so an unanchored absolute span takes its
          static position from the CENTRE and the knob ends up hidden off the
          pill — which read as an all-blue toggle. */}
      <span
        aria-hidden="true"
        className={`absolute left-0.5 top-0.5 block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
