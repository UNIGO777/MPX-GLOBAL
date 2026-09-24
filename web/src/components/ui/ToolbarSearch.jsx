import { SearchIcon, XIcon } from './icons.jsx';

/**
 * The search box of a list toolbar (owner, 2026-09-24): white, rounded, with a
 * visible border and a soft shadow — a borderless grey field vanished into the
 * tinted page canvas. Pairs with `FilterChip`.
 *
 * Controlled; the page decides whether it searches as you type or on Enter
 * (`onSubmit`), since some admin searches are "starts with" on the server.
 */
export function ToolbarSearch({ id, label, value, onChange, onSubmit, onClear, placeholder, maxLength = 100 }) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className="relative w-full"
    >
      <label htmlFor={id} className="sr-only">{label}</label>
      <SearchIcon
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="search-own-clear h-10 w-full rounded-full border border-ink-200 bg-white pl-10 pr-10 text-[13px] text-ink-900 shadow-sm transition-colors placeholder:text-ink-500 hover:border-ink-300 focus:border-primary-600 focus:outline-none focus:ring-4 focus:ring-primary-600/10"
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}
