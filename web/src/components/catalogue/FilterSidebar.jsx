import { useState } from 'react';

import { CheckIcon, ChevronDownIcon, PlusIcon, XIcon } from '../ui/icons.jsx';
import { Skeleton } from '../ui/Skeleton.jsx';

/**
 * Real, backend-wired category filter sidebar — `GET /public/facets` drives
 * every option and count shown here; nothing is invented or hardcoded.
 *
 * Scoped to what was actually asked for: a verified-only toggle, a price
 * range, and the category's own filterable specs (material, GSM, etc. —
 * whatever `CategoryAttribute.filterable: true` defines for this category).
 * Deliberately NOT included: country/goods-vs-service facets (present in the
 * API, not part of this ask) and a category facet (moot — this page is
 * already scoped to one category by its URL).
 *
 * Counts already exclude each filter's OWN selection server-side (§A27.2) —
 * picking "Cotton" never zeroes out "Silk" in the same group. Never
 * recompute or second-guess a count here; render exactly what the API sent.
 *
 * A NUMBER attribute (e.g. GSM) renders as a min/max range, like price —
 * everything else (select/text/boolean) renders as a pill-option list with a
 * live count per option (shown as a hover title, not inline text — see §2 of
 * the 2026-08-12 pass below). Both shapes come from the same `attributes[]`
 * array; branch on `inputType === 'number'`.
 *
 * STYLING PASSES:
 * 2026-08-11 — collapsible sections (chevron) + "+N more" truncation.
 * 2026-08-12 (owner: match the reference mockup crop "exact same") —
 *   1. Section headings promoted to bold text-lg primary-800 (were small
 *      uppercase-tracking muted labels) — matches the reference's heading
 *      weight throughout.
 *   2. Select/text/boolean attribute options render as PILL buttons with a
 *      "+" icon (a check icon when selected, filled primary background) —
 *      replacing the checkbox+label+count row. The live count moves to a
 *      hover `title` and an `aria-label` rather than disappearing outright,
 *      so the real number is still there for anyone who needs it, just not
 *      competing with the reference's plain pill look.
 *   3. Price/number-range inputs are UNCHANGED as real number inputs, not
 *      converted to the reference's `<select>` dropdowns — our price range is
 *      continuous, real data, with no natural small set of bucket options
 *      behind it. A dropdown implies discrete choices; faking bucket options
 *      with no real data behind them would be inventing a filter shape that
 *      doesn't exist, the same category of thing as the earlier "Inquiry"
 *      button decision — shown honestly as what it functionally is, not
 *      whatever looks closest to the reference.
 */
const OPTIONS_SHOW_LIMIT = 6;

export function FilterSidebar({
  facets,
  loading,
  verifiedOnly,
  priceMin,
  priceMax,
  attrSelections,
  onToggleVerified,
  onPriceChange,
  onAttrToggle,
  onAttrRangeChange,
  onClearAll,
}) {
  const appliedChips = buildAppliedChips({
    verifiedOnly,
    priceMin,
    priceMax,
    priceCurrency: facets?.price?.currency,
    attrSelections,
    attributes: facets?.attributes ?? [],
    onToggleVerified,
    onPriceChange,
    onAttrToggle,
    onAttrRangeChange,
  });

  return (
    <div className="rounded-2xl border border-surface-border bg-white p-4 shadow-card">
      {appliedChips.length > 0 && (
        <div className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-primary-800">Applied Filters</h2>
            <button type="button" onClick={onClearAll} className="text-sm font-medium text-primary-700 hover:underline">
              Clear All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {appliedChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={chip.onRemove}
                className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 py-1 pl-3 pr-2 text-sm font-medium text-primary-700"
              >
                {chip.label}
                <XIcon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-5 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-primary-800">Verified sellers</h2>
          <span className="mt-1 inline-flex items-center gap-1 rounded bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
            <CheckIcon className="h-3 w-3" aria-hidden="true" />
            Verified by MPX
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={verifiedOnly}
          onClick={onToggleVerified}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            verifiedOnly ? 'bg-primary-600' : 'bg-ink-200'
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              verifiedOnly ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      <hr className="mb-5 border-surface-border" />

      <FilterSection title={`Price${facets?.price?.currency ? ` (${facets.price.currency})` : ''}`}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder={facets?.price ? String(facets.price.min) : 'No min'}
            value={priceMin ?? ''}
            onChange={(e) => onPriceChange(e.target.value, priceMax)}
            className="h-10 w-full rounded-lg border border-surface-border px-3 text-sm text-ink-700 outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
          />
          <span className="text-muted">–</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder={facets?.price ? String(facets.price.max) : 'No max'}
            value={priceMax ?? ''}
            onChange={(e) => onPriceChange(priceMin, e.target.value)}
            className="h-10 w-full rounded-lg border border-surface-border px-3 text-sm text-ink-700 outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
          />
        </div>
      </FilterSection>

      {loading ? (
        <div className="space-y-3 border-t border-surface-border pt-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-4/5" />
        </div>
      ) : (
        (facets?.attributes ?? []).map((attr) => (
          <FilterSection
            key={attr.key}
            title={`${attr.name}${attr.unit && attr.unit.toLowerCase() !== attr.name.toLowerCase() ? ` (${attr.unit})` : ''}`}
          >
            {attr.inputType === 'number' ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder={attr.bounds ? String(attr.bounds.min) : 'Min'}
                  value={attrSelections[attr.key]?.min ?? ''}
                  onChange={(e) => onAttrRangeChange(attr.key, e.target.value, attrSelections[attr.key]?.max)}
                  className="h-10 w-full rounded-lg border border-surface-border px-3 text-sm text-ink-700 outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
                />
                <span className="text-muted">–</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder={attr.bounds ? String(attr.bounds.max) : 'Max'}
                  value={attrSelections[attr.key]?.max ?? ''}
                  onChange={(e) => onAttrRangeChange(attr.key, attrSelections[attr.key]?.min, e.target.value)}
                  className="h-10 w-full rounded-lg border border-surface-border px-3 text-sm text-ink-700 outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
                />
              </div>
            ) : (
              <AttrOptionPills attr={attr} selected={attrSelections[attr.key] ?? []} onToggle={onAttrToggle} />
            )}
          </FilterSection>
        ))
      )}
    </div>
  );
}

/** One collapsible section — bold heading + chevron (rotates open, same
 *  convention as `Combobox`'s own toggle) + content. Open by default; purely
 *  a display state, never affects which filters are active. */
function FilterSection({ title, children }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-surface-border pb-5 pt-5 first-of-type:pt-0 last:border-b-0 last:pb-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between text-left">
        <span className="text-lg font-bold text-primary-800">{title}</span>
        <ChevronDownIcon className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

/** Select/text/boolean attribute options as pill buttons — a "+" icon
 *  (unselected) or a check icon on a filled primary pill (selected),
 *  matching the reference exactly. The live count from the API isn't
 *  dropped, just moved off the visible pill face and onto `title`/
 *  `aria-label`, so it's still there for anyone who needs it.
 *
 *  Truncated past `OPTIONS_SHOW_LIMIT` with a "+N more" expand — a category
 *  with many option values (e.g. colour) shouldn't make the sidebar
 *  unscannable. Anything already selected stays visible even before
 *  expanding, so ticking one near the bottom never looks like it silently
 *  un-selected itself. */
function AttrOptionPills({ attr, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const options = attr.options ?? [];

  const visible = expanded
    ? options
    : (() => {
        const head = options.slice(0, OPTIONS_SHOW_LIMIT);
        const missingSelected = options.slice(OPTIONS_SHOW_LIMIT).filter((o) => selected.includes(String(o.value)));
        return [...head, ...missingSelected];
      })();
  const hiddenCount = options.length - visible.length;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {visible.map((opt) => {
          const value = String(opt.value);
          const checked = selected.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => onToggle(attr.key, value)}
              title={`${opt.count} match${opt.count === 1 ? '' : 'es'}`}
              aria-pressed={checked}
              aria-label={`${value}, ${opt.count} match${opt.count === 1 ? '' : 'es'}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                checked
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-surface-border bg-white text-ink-700 hover:border-primary-600 hover:text-primary-700'
              }`}
            >
              {checked ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
              {value}
            </button>
          );
        })}
      </div>
      {hiddenCount > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className="mt-3 text-sm font-medium text-primary-700 hover:underline">
          + {hiddenCount} more
        </button>
      )}
      {expanded && options.length > OPTIONS_SHOW_LIMIT && (
        <button type="button" onClick={() => setExpanded(false)} className="mt-3 text-sm font-medium text-primary-700 hover:underline">
          Show less
        </button>
      )}
    </>
  );
}

/** Builds the "Applied filters" chip list — each chip's `onRemove` reverses
 *  exactly that one selection via the same setter callbacks the controls
 *  above use, so removing a chip and unchecking its pill do the same
 *  thing. */
function buildAppliedChips({
  verifiedOnly,
  priceMin,
  priceMax,
  priceCurrency,
  attrSelections,
  attributes,
  onToggleVerified,
  onPriceChange,
  onAttrToggle,
  onAttrRangeChange,
}) {
  const chips = [];
  if (verifiedOnly) {
    chips.push({ id: 'verified', label: 'Verified sellers', onRemove: onToggleVerified });
  }
  if (priceMin || priceMax) {
    const label = `${priceCurrency ?? ''} ${priceMin || '0'} – ${priceMax || 'any'}`.trim();
    chips.push({ id: 'price', label, onRemove: () => onPriceChange(null, null) });
  }
  for (const [key, val] of Object.entries(attrSelections ?? {})) {
    const attr = attributes.find((a) => a.key === key);
    if (!attr) continue;
    if (Array.isArray(val)) {
      for (const v of val) {
        chips.push({ id: `${key}:${v}`, label: v, onRemove: () => onAttrToggle(key, v) });
      }
    } else if (val && (val.min || val.max)) {
      chips.push({
        id: `${key}:range`,
        label: `${attr.name} ${val.min || attr.bounds?.min || ''}–${val.max || attr.bounds?.max || ''}`,
        onRemove: () => onAttrRangeChange(key, null, null),
      });
    }
  }
  return chips;
}
