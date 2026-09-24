import { useEffect, useId, useRef, useState } from 'react';

import { CheckIcon, ChevronDownIcon } from './icons.jsx';

/**
 * A filter as a CHIP (owner, 2026-09-24 — admin list toolbars). Replaces a row
 * of full-width dropdowns that read as form fields, gave no hint which filters
 * were on, and wrapped unevenly on phones.
 *
 * - Off (value ''): a white pill reading just the dimension — "Side ▾".
 * - On: brand-tinted and reads its value — "Side: Exporter side ▾" — so the
 *   active filters are visible at a glance.
 *
 * The menu is POSITIONED FIXED from the chip's own rect: chips live in a row
 * that scrolls sideways on phones, and an absolutely-positioned menu inside a
 * scrolling row is clipped. It closes on outside click, Esc, scroll and resize.
 * Keyboard: ↑/↓ move, Enter picks, Esc closes (focus returns to the chip).
 *
 * `options`: [{ value, label }] — the '' option is the "any" choice.
 */
export function FilterChip({ label, value, options, onChange }) {
  const menuId = useId();
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [hi, setHi] = useState(0);

  const active = value !== '' && value !== undefined && value !== null;
  const selected = options.find((o) => o.value === value);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 240;
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width });
  };

  const openMenu = () => {
    place();
    setHi(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const close = (refocus = false) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) close();
    };
    const onAway = () => close();
    // Page scroll closes the fixed menu (it would drift off its chip) — but a
    // scroll INSIDE the menu is the person reading a long list (40 categories).
    // The capture listener sees both, so it used to close on the first wheel.
    const onScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onAway);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onAway);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const pick = (o) => {
    onChange(o.value);
    close(true);
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openMenu();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (options[hi]) pick(options[hi]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-activedescendant={open ? `${menuId}-${hi}` : undefined}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={`inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold shadow-sm transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/15 ${
          active
            ? 'border-primary-600 bg-primary-50 text-primary-700'
            : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50'
        }`}
      >
        <span>
          {label}
          {active && selected ? ':' : ''}
        </span>
        {active && selected && <span className="font-medium">{selected.label}</span>}
        <ChevronDownIcon
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''} ${active ? 'text-primary-600' : 'text-ink-400'}`}
          aria-hidden="true"
        />
      </button>

      {open && pos && (
        <ul
          ref={menuRef}
          id={menuId}
          role="listbox"
          aria-label={label}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
          className="z-50 max-h-72 overflow-y-auto rounded-xl border border-surface-border bg-white py-1 shadow-lift"
        >
          {options.map((o, i) => {
            const isSel = o.value === value;
            return (
              <li key={o.value || 'any'} id={`${menuId}-${i}`} role="option" aria-selected={isSel}>
                <button
                  type="button"
                  tabIndex={-1}
                  // Same as the shared Combobox: highlight rose, the chosen value
                  // in brand red, and the pick waits for click so a touch-scroll
                  // never selects.
                  onPointerDown={(e) => e.preventDefault()}
                  onPointerEnter={() => setHi(i)}
                  onClick={() => pick(o)}
                  className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm ${
                    i === hi ? 'bg-primary-50' : ''
                  } ${isSel ? 'font-medium text-primary-700' : 'text-ink-800'}`}
                >
                  {o.label}
                  {isSel && <CheckIcon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
