import { inputClasses } from '../ui/Field.jsx';
import { PlusIcon, TrashIcon } from '../ui/icons.jsx';

/**
 * Seller-written specifications (client change request, owner-approved
 * 2026-09-23). A short list of label + value rows the exporter defines
 * themselves, for details their category's own fields do not cover.
 *
 * Display-only on the server side: shown on the product page, never searched or
 * filtered. The server enforces the cap, unique labels, "not one of the
 * category's own fields" and "no contact details"; this editor mirrors the cap
 * and flags a half-filled row, and the save error names anything else.
 */
export const MAX_CUSTOM_SPECS = 10;

export function CustomSpecsEditor({ rows, onChange, disabled }) {
  const update = (i, patch) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const remove = (i) => onChange(rows.filter((_, j) => j !== i));
  const add = () => onChange([...rows, { label: '', value: '' }]);
  const full = rows.length >= MAX_CUSTOM_SPECS;

  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        <div className="space-y-2.5">
          {rows.map((r, i) => {
            // Half-filled: one side typed, the other blank — the server would
            // refuse the whole save, so say so on the row itself.
            const half = Boolean(r.label.trim()) !== Boolean(r.value.trim());
            return (
              <div key={i} className="flex items-start gap-2">
                <input
                  aria-label={`Specification ${i + 1} name`}
                  placeholder="Specification"
                  maxLength={40}
                  value={r.label}
                  disabled={disabled}
                  onChange={(e) => update(i, { label: e.target.value })}
                  className={inputClasses(half && !r.label.trim(), 'sm:w-2/5')}
                />
                <input
                  aria-label={`Specification ${i + 1} value`}
                  placeholder="Details"
                  maxLength={200}
                  value={r.value}
                  disabled={disabled}
                  onChange={(e) => update(i, { value: e.target.value })}
                  className={inputClasses(half && !r.value.trim())}
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={disabled}
                  aria-label={`Remove specification ${i + 1}`}
                  className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-danger-50 hover:text-danger disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={add}
          disabled={disabled || full}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-primary-300 px-3.5 py-2 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:border-ink-200 disabled:text-ink-400 disabled:hover:bg-transparent"
        >
          <PlusIcon className="h-4 w-4" />
          {rows.length === 0 ? 'Add a specification' : 'Add another specification'}
        </button>
        <span className="text-xs text-muted">
          {rows.length}/{MAX_CUSTOM_SPECS} · no emails, phone numbers or links
        </span>
      </div>
    </div>
  );
}
