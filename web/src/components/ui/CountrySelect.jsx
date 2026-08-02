import { useEffect, useMemo, useRef, useState } from 'react';

import { COUNTRIES, countryName } from '../../lib/countries.js';
import { Field, inputClasses } from './Field.jsx';
import { ChevronDownIcon, SearchIcon } from './icons.jsx';

/**
 * Searchable country picker (~200 entries — a bare native select is unusable
 * at this length, per the design brief). Lightweight combobox: a button that
 * opens a filterable list. Stores the ISO alpha-2 code, exactly what the
 * backend validates.
 */
export function CountrySelect({ label = 'Country', helper, error, optional, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q);
  }, [query]);

  const pick = (code) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };

  return (
    <Field label={label} helper={helper} error={error} optional={optional}>
      {(id, hasError) => (
        <div ref={rootRef} className="relative">
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className={inputClasses(hasError, 'flex items-center justify-between text-left')}
          >
            <span className={value ? 'text-ink-900' : 'text-ink-500'}>
              {value ? countryName(value) : 'Choose a country'}
            </span>
            <ChevronDownIcon className="h-4 w-4 text-ink-500" />
          </button>

          {open && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-surface-border bg-white shadow-card">
              <div className="flex items-center gap-2 border-b border-surface-border px-3">
                <SearchIcon className="h-4 w-4 text-ink-500" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search countries"
                  aria-label="Search countries"
                  className="h-10 w-full text-sm outline-none placeholder:text-ink-500"
                />
              </div>
              <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
                {filtered.length === 0 && (
                  <li className="px-3 py-2 text-sm text-muted">No countries match.</li>
                )}
                {filtered.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === c.code}
                      onClick={() => pick(c.code)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-primary-50 ${
                        value === c.code ? 'bg-primary-50 font-medium text-primary-800' : 'text-ink-800'
                      }`}
                    >
                      {c.name}
                      <span className="text-xs text-muted">{c.code}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Field>
  );
}
