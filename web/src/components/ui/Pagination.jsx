import { config } from '../../config.js';
import { ChevronLeftIcon, ChevronRightIcon } from './icons.jsx';

/**
 * Pager, in two shapes over ONE page-list implementation.
 *
 *  - **Admin table footer** (default): "1–20 of 1,248 · rows-per-page · prev/next".
 *    The largest rows option must stay within the server's own hard cap (config.js).
 *  - **Public catalogue grid** (`onPageSize` omitted): the rows-per-page control
 *    disappears — a buyer has no reason to tune it, and the M2 designs do not
 *    draw one. Pass `compact` to also drop the "Showing x–y" line and centre the
 *    controls, which is the catalogue layout.
 *
 * Kept as one component on purpose: a second pager would duplicate `pageList`,
 * and the two would drift the first time the ellipsis rule changed.
 */
const ROW_OPTIONS = config.table.pageSizes;

/** 1 2 3 … 63 — leading pages, an ellipsis, then the last (design's shape). */
function pageList(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const near = [page - 1, page, page + 1].filter((n) => n > 1 && n < pages);
  const set = [...new Set([1, 2, 3, ...near, pages])].sort((a, b) => a - b);
  const out = [];
  set.forEach((n, i) => {
    if (i > 0 && n - set[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}

export function Pagination({ page, pageSize, total, onPage, onPageSize, compact = false }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={`flex flex-wrap items-center gap-3 py-3 text-sm text-muted ${
        compact ? 'justify-center' : 'justify-between border-t border-surface-border px-4'
      }`}
    >
      {!compact && (
      <p>
        Showing <span className="font-medium text-ink-800">{from}–{to}</span> of{' '}
        <span className="font-medium text-ink-800">{total.toLocaleString(config.locale.numbers)}</span>
      </p>
      )}
      <div className="flex items-center gap-4">
        {/* Public grids omit onPageSize — no control, not a disabled one. */}
        {onPageSize && (
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
        )}
        {/* Design: ‹ 1 2 3 … 63 › — current page is a filled navy square */}
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
          {pageList(page, pages).map((n, i) =>
            n === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-ink-400">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => onPage(n)}
                aria-current={n === page ? 'page' : undefined}
                aria-label={`Page ${n}`}
                className={`h-8 min-w-8 rounded-md px-2 text-sm font-medium ${
                  n === page ? 'bg-primary-800 text-white' : 'text-ink-800 hover:bg-ink-100'
                }`}
              >
                {n}
              </button>
            ),
          )}
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
