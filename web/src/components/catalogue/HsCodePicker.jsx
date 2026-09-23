import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { productsApi } from '../../api/products.js';
import { inputClasses } from '../ui/Field.jsx';
import { SearchIcon } from '../ui/icons.jsx';

/**
 * HS code picker (owner, 2026-09-24). Searches the HS 2022 list on the SERVER
 * as the seller types — ~5,600 codes is too many to ship to the browser and
 * filter, which is how the shared `Combobox` works. Same keyboard and ARIA
 * contract as that component: ↑/↓ move, Enter picks, Esc closes.
 *
 * The seller normally picks a listed code; when theirs isn't listed (a national
 * 8-digit code, a newer edition) a well-formed 6–8 digit entry can be used
 * as typed — the "Use code …" row. The server normalises and re-checks either
 * way (`product.validators.js`).
 *
 * The typed text is a FILTER, never the value: only a pick calls `onChange`.
 */
export const formatHsCode = (code = '') =>
  /^\d{6,8}$/.test(code) ? code.replace(/^(\d{4})(\d{2})(\d{2})?$/, (_, a, b, c) => [a, b, c].filter(Boolean).join('.')) : code;

const digitsOf = (text) => text.replace(/[\s.-]/g, '');

export function HsCodePicker({ id, value, onChange, hasError = false }) {
  const listId = useId();
  const rootRef = useRef(null);
  const [query, setQuery] = useState(null); // null = not editing
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced((query ?? '').trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const search = useQuery({
    queryKey: ['hs-codes', debounced],
    queryFn: () => productsApi.hsCodes(debounced),
    enabled: open && debounced.length >= 2,
    staleTime: Infinity, // static reference data
  });

  // The label for the SAVED value (its description), looked up once.
  const saved = useQuery({
    queryKey: ['hs-codes', 'label', value],
    queryFn: () => productsApi.hsCodes(value.slice(0, 6), 1),
    enabled: /^\d{6,8}$/.test(value ?? ''),
    staleTime: Infinity,
  });
  const savedDescription = saved.data?.[0]?.code === value?.slice(0, 6) ? saved.data[0].description : null;

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

  const results = search.data ?? [];
  const typed = digitsOf(debounced);
  const canUseTyped = /^\d{6,8}$/.test(typed) && !results.some((r) => r.code === typed);
  const options = [
    ...results.map((r) => ({ code: r.code, description: r.description })),
    ...(canUseTyped ? [{ code: typed, description: null, typed: true }] : []),
  ];

  const pick = (o) => {
    onChange(o.code);
    setQuery(null);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHi((h) => Math.min(h + 1, Math.max(options.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && open && options[hi]) {
      e.preventDefault();
      pick(options[hi]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(null);
    }
  };

  const shown =
    query ??
    (value ? (savedDescription ? `${formatHsCode(value)} · ${savedDescription}` : formatHsCode(value)) : '');

  let status = null;
  if (open && debounced.length < 2) status = 'Type a product word or a code, e.g. “cotton” or “5208”.';
  else if (open && search.isFetching && !search.data) status = 'Searching…';
  else if (open && search.isError) status = 'Search is unavailable right now. Try again in a moment.';
  else if (open && search.isSuccess && options.length === 0) status = 'No matching HS code. Type the 6–8 digit code to use it.';

  return (
    <div ref={rootRef} className="relative">
      <SearchIcon
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
        aria-hidden="true"
      />
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[hi] ? `${listId}-${hi}` : undefined}
        autoComplete="off"
        value={shown}
        placeholder="Search by product or code, e.g. cotton or 5208"
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
        className={inputClasses(hasError, 'truncate pl-9')}
      />

      {open && (status || options.length > 0) && (
        <ul
          id={listId}
          role="listbox"
          // WIDER than its field (owner, 2026-09-24: "this opened window is
          // small"). HS descriptions are long; squeezed to a one-third-width
          // form column every row wrapped into a tall ribbon.
          className="absolute left-0 z-30 mt-1 max-h-[26rem] w-[min(40rem,calc(100vw-3rem))] overflow-y-auto rounded-xl border border-surface-border bg-white py-1 shadow-lift"
        >
          {status && <li className="px-3 py-2.5 text-[13px] text-muted">{status}</li>}
          {options.map((o, i) => (
            <li key={`${o.code}-${o.typed ? 't' : 'l'}`} id={`${listId}-${i}`} role="option" aria-selected={i === hi}>
              <button
                type="button"
                // Highlight and touch behaviour match the shared Combobox.
                onPointerDown={(e) => e.preventDefault()}
                onPointerEnter={() => setHi(i)}
                onClick={() => pick(o)}
                title={o.description ?? undefined}
                className={`flex w-full items-start gap-3 px-3.5 py-2.5 text-left ${i === hi ? 'bg-primary-50' : ''}`}
              >
                <span className="w-[4.75rem] shrink-0 pt-px font-mono text-[13px] font-semibold text-ink-900">
                  {formatHsCode(o.code)}
                </span>
                <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-snug text-ink-700">
                  {o.typed ? (
                    <span className="font-medium text-primary-700">Use this code — it isn’t in the HS 2022 list</span>
                  ) : (
                    o.description
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
