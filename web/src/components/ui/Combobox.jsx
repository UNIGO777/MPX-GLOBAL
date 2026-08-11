import { useEffect, useMemo, useRef, useState } from 'react';

import { inputClasses } from './Field.jsx';
import { ChevronDownIcon } from './icons.jsx';

/**
 * The ONE dropdown primitive (owner, 2026-08-11: "all the dropdowns should be
 * hybrid"). A hybrid combobox: the field is a real text input — click or focus
 * opens the full list, typing filters it — replacing every native `<select>`,
 * whose OS popup can't be typed in and clips long labels in narrow columns.
 *
 * Behaviour contract:
 * - The typed text is a FILTER, never a value. Only picking an option calls
 *   `onChange`; closing without a pick restores the selected label, so free
 *   text can never reach the server.
 * - Options render inside a matching-width popover and WRAP instead of
 *   truncating — the list can never "go off the field".
 * - Full keyboard support: ↑/↓ move, Enter picks, Esc closes, Tab closes and
 *   moves on. ARIA combobox/listbox with `aria-activedescendant`.
 *
 * `options`: [{ value, label, hint? }] — `hint` renders muted on the right
 * (country codes, currency names). Matching is on label, value and hint.
 */
export function Combobox({
  id,
  value,
  options = [],
  onChange,
  placeholder = 'Select…',
  disabled = false,
  hasError = false,
  notFound = 'No matches.',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(null); // null = not editing → show selected label
  const [hi, setHi] = useState(0);
  const [alignRight, setAlignRight] = useState(false);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = (query ?? '').trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        String(o.value).toLowerCase().includes(q) ||
        (o.hint && o.hint.toLowerCase().includes(q)),
    );
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery(null);
    setHi(0);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (e) => {
      if (!rootRef.current?.contains(e.target)) close();
    };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
  }, [open]);

  // Keep the highlighted option in view while arrowing through the list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${hi}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [hi, open]);

  // The popover sizes to its CONTENT (long labels were colliding with their
  // hints inside narrow fields — owner, 2026-08-11). Content-sized means it
  // can poke past the right viewport edge for fields near it, so measure once
  // open and flip to right-alignment when needed.
  useEffect(() => {
    if (!open) {
      setAlignRight(false);
      return;
    }
    const el = listRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) setAlignRight(true);
  }, [open, query]);

  const pick = (opt) => {
    onChange(opt.value);
    close();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHi((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && filtered[hi]) {
        e.preventDefault();
        pick(filtered[hi]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.stopPropagation();
        close();
      }
    } else if (e.key === 'Tab') {
      close();
    }
  };

  const listId = id ? `${id}-listbox` : undefined;

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[hi] ? `${listId}-${hi}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        className={inputClasses(hasError, 'pr-9')}
        value={query ?? selected?.label ?? ''}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setHi(0);
          if (!open) setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? 'Close options' : 'Show options'}
        disabled={disabled}
        // pointerdown (not click): runs before the input's blur, so toggling
        // while open doesn't close-then-reopen.
        onPointerDown={(e) => {
          e.preventDefault();
          if (open) close();
          else {
            inputRef.current?.focus();
            setOpen(true);
          }
        }}
        className="absolute right-1 top-1/2 flex h-9 w-8 -translate-y-1/2 items-center justify-center rounded text-ink-500 hover:text-ink-700 disabled:opacity-50"
      >
        <ChevronDownIcon
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className={`absolute z-30 mt-1 max-h-60 w-max min-w-full max-w-[340px] overflow-y-auto rounded-lg border border-surface-border bg-white py-1 shadow-lift ${
            alignRight ? 'right-0' : 'left-0'
          }`}
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">{notFound}</li>
          )}
          {filtered.map((o, i) => (
            <li key={String(o.value)} id={listId ? `${listId}-${i}` : undefined} data-index={i}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                tabIndex={-1}
                // pointerdown so the pick lands before the input blurs.
                onPointerDown={(e) => {
                  e.preventDefault();
                  pick(o);
                }}
                onPointerEnter={() => setHi(i)}
                className={`flex w-full items-baseline justify-between gap-4 whitespace-normal px-3 py-2 text-left text-sm ${
                  i === hi ? 'bg-primary-50' : ''
                } ${o.value === value ? 'font-medium text-primary-800' : 'text-ink-800'}`}
              >
                <span className="min-w-0 flex-1">{o.label}</span>
                {o.hint && <span className="shrink-0 whitespace-nowrap text-xs text-muted">{o.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
