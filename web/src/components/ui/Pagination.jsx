import { config } from '../../config.js';
import { ChevronLeftIcon, ChevronRightIcon } from './icons.jsx';

/**
 * Table footer pager: "1–20 of 1,248 · rows-per-page · prev/next". The largest
 * option must stay within the server's own hard cap (config.js).
 */
const ROW_OPTIONS = config.table.pageSizes;

export function Pagination({ page, pageSize, total, onPage, onPageSize }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border px-4 py-3 text-sm text-muted">
      <p>
        Showing <span className="font-medium text-ink-800">{from}–{to}</span> of{' '}
        <span className="font-medium text-ink-800">{total.toLocaleString(config.locale.numbers)}</span>
      </p>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          Rows per page
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-8 rounded-md border border-surface-border bg-white px-2 text-sm text-ink-800"
          >
            {ROW_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 disabled:cursor-not-allowed disabled:text-ink-300"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <span className="min-w-16 text-center text-ink-800">
            {page} / {pages}
          </span>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= pages}
            aria-label="Next page"
            className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100 disabled:cursor-not-allowed disabled:text-ink-300"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
