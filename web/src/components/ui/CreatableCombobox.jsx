import { useEffect, useId, useRef, useState } from 'react';

import { inputClasses } from './Field.jsx';
import { ChevronDownIcon } from './icons.jsx';

/**
 * A dropdown that ALSO accepts a typed value (owner, 2026-09-24 — the product
 * form's Unit). The shared `Combobox` deliberately refuses free text; this one
 * is for lists that are a strong suggestion rather than a rule: pick a standard
 * value, or use exactly what you typed via the "Use “…”" row.
 *
 * Same keyboard/ARIA contract as `Combobox`: ↑/↓ move, Enter picks, Esc closes.
 * The typed text is a FILTER until a row is picked — only a pick calls
 * `onChange`, so a half-typed word never becomes the value by accident.
 *
 * `options`: [{ value, label, hint? }]. Matching is on label, value and hint.
 */
export function CreatableCombobox({
  id,
  value,
  options = [],
  onChange,
  placeholder = 'Select or type…',
  hasError = false,
  maxLength = 40,
  ariaLabel,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(null); // null = not editing
  const [hi, setHi] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false);
        setQuery(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const q = (query ?? '').trim().toLowerCase();
  // Prefix matches first, shortest label first — so "met" offers Meter before
  // Metric ton — then any other match, in list order.
  const filtered = q
    ? options
        .filter((o) => [o.label, o.value, o.hint].some((t) => String(t ?? '').toLowerCase().includes(q)))
        .map((o, i) => ({ o, i, prefix: o.label.toLowerCase().startsWith(q) || o.value.startsWith(q) }))
        .sort((a, b) => (b.prefix - a.prefix) || (a.prefix && b.prefix ? a.o.label.length - b.o.label.length : 0) || a.i - b.i)
        .map(({ o }) => o)
    : options;
  const typed = (query ?? '').trim();
  const exact = options.some((o) => o.value.toLowerCase() === q || o.label.toLowerCase() === q);
  const rows = [
    ...filtered.map((o) => ({ ...o })),
    ...(typed && !exact ? [{ value: typed, label: `Use “${typed}”`, typed: true }] : []),
  ];

  const pick = (row) => {
    onChange(row.value);
    setQuery(null);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHi((h) => Math.min(h + 1, Math.max(rows.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && open && rows[hi]) {
      e.preventDefault();
      pick(rows[hi]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(null);
    }
  };

  const selected = options.find((o) => o.value === value);
  const shown = query ?? (selected ? selected.label : value ?? '');

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && rows[hi] ? `${listId}-${hi}` : undefined}
        aria-invalid={hasError || undefined}
        autoComplete="off"
        maxLength={maxLength}
        value={shown}
        placeholder={placeholder}
        onFocus={(e) => {
          setOpen(true);
          if (query === null) {
            setQuery('');
            e.target.select();
          }
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onKeyDown={onKeyDown}
        className={inputClasses(hasError, 'pr-9')}
      />
      <ChevronDownIcon
        className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500 transition-transform ${
          open ? 'rotate-180' : ''
        }`}
        aria-hidden="true"
      />

      {open && rows.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 z-30 mt-1 max-h-72 w-full min-w-[14rem] overflow-y-auto rounded-xl border border-surface-border bg-white py-1 shadow-lift"
        >
          {rows.map((o, i) => (
            <li key={`${o.value}-${o.typed ? 't' : 'l'}`} id={`${listId}-${i}`} role="option" aria-selected={i === hi}>
              <button
                type="button"
                // Same as the shared Combobox: highlight rose, the chosen value
                // in brand red, and the pick waits for CLICK (pointerdown only
                // keeps focus) so a touch-scroll never selects by accident.
                onPointerDown={(e) => e.preventDefault()}
                onPointerEnter={() => setHi(i)}
                onClick={() => pick(o)}
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm ${
                  i === hi ? 'bg-primary-50' : ''
                } ${o.value === value && !o.typed ? 'font-medium text-primary-700' : 'text-ink-800'}`}
              >
                <span className={o.typed ? 'font-medium text-primary-700' : ''}>{o.label}</span>
                {o.hint && <span className="shrink-0 text-xs text-muted">{o.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
