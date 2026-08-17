import { useState } from 'react';

import { countryName as countryNameOf } from '../../lib/countries.js';
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
 * 2026-08-12 (owner: "sidebar is not looking good, redesign it, make it very
 *   professional") — added `bare`: on desktop this now renders as one
 *   section inside a single unified card shared with the sub-category rail
 *   (built by the caller, `CategoryListing`), instead of two separate
 *   shadow-card boxes stacked with a gap. `bare` strips this component's own
 *   border/shadow/rounding so it can sit flush inside that shared card
 *   without a double border. Mobile keeps calling this WITHOUT `bare` — it
 *   has no shared card to sit inside, so it stays a standalone card there.
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
  bare = false,
  // `/search` extras (2026-08-14, build-plan Phase 2) — SINGLE-select facet
  // groups the API already served but `/category/:slug` deliberately omits
  // (its category is fixed by the URL; country wasn't part of that ask).
  // Rendered ONLY when the page passes the handler, so /category is untouched.
  selectedCategory = null,
  onCategoryChange = null,
  selectedCountry = null,
  onCountryChange = null,
  // AI search (build-plan Phase 3) can derive a moqMin the buyer never typed
  // into a widget — `/public/search` has always accepted the param, there was
  // just no manual control for it (deferred, "future /search work"). No input
  // is added here on purpose; this only lets an AI-set MOQ show as a normal
  // removable chip, same as everything else in this list.
  moqMin = null,
  onMoqChange = null,
  // 2026-08-17 (owner: "not standard for a filter section" / "enhance the
  // whole sidebar"): `panel` is the /search rail's presentation — ONE card,
  // a real header row, hairline-divided sections, sidebar type scale, and an
  // optional `leadingSection` (the categories list) INSIDE the same panel.
  // It replaces the earlier `split` card-per-group layout, which read as six
  // disconnected boxes floating in a column. Default (false) keeps the
  // single-card/drawer layout that /category and the <lg overlay use.
  panel = false,
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
    selectedCategory,
    onCategoryChange,
    categoryFacet: facets?.category ?? [],
    selectedCountry,
    onCountryChange,
    countryName: countryNameOf,
    moqMin,
    onMoqChange,
  });

  const cardCls = 'rounded-2xl border border-surface-border bg-white p-4 shadow-card';

  // 🔴 A filter the buyer cannot actually narrow with is noise, not an option
  // (owner design review, 2026-08-17). Two cases, both seen live:
  //   · price with NO bounds → "No min / No max" over an empty range;
  //   · a range whose min EQUALS its max (GSM 200–200), or a list with a
  //     single option — picking it changes nothing.
  // The server's counts are untouched; this only decides what is worth showing.
  const showPrice = Boolean(facets?.price && facets.price.min !== facets.price.max);
  const usefulAttributes = (facets?.attributes ?? []).filter((attr) =>
    attr.inputType === 'number'
      ? attr.bounds && attr.bounds.min !== attr.bounds.max
      : (attr.options?.length ?? 0) > 1,
  );

  // Anything inside the "More filters" disclosure that is already set forces
  // it open on arrival (price bound, MOQ, or any attribute selection).
  const hasHiddenActive = Boolean(priceMin || priceMax || moqMin || Object.keys(attrSelections ?? {}).length);
  const [moreOpen, setMoreOpen] = useState(hasHiddenActive);

  const alwaysVisible = (
    <>
      {/* The rail's page already renders this exact chip row above the results
          (`buildAppliedChips` is shared), so repeating it inside the panel was
          the same control twice on one screen (owner screenshot, 2026-08-17).
          The drawer keeps its copy — it covers the page, so it is the only
          place the buyer can see what is applied. */}
      {!panel && appliedChips.length > 0 && (
        <div className={panel ? 'border-b border-surface-border px-4 py-3.5' : 'mb-5'}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className={panel ? 'text-[13px] font-bold uppercase tracking-wide text-ink-400' : 'text-lg font-bold text-primary-800'}>
              Applied
            </h2>
            {/* The panel's own header owns "Clear all" — a second one here
                was pure duplication (owner, 2026-08-17). */}
            {!panel && (
              <button type="button" onClick={onClearAll} className="text-sm font-medium text-primary-700 hover:underline">
                Clear All
              </button>
            )}
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

      <div className={`flex items-center justify-between gap-3 ${panel ? 'border-b border-surface-border px-4 py-3.5' : 'mb-5'}`}>
        <div>
          <h2 className={panel ? 'text-sm font-semibold text-ink-900' : 'text-lg font-bold text-primary-800'}>
            Verified sellers
          </h2>
          <span className={`mt-1 inline-flex items-center gap-1 rounded bg-success-50 px-2 py-0.5 font-medium text-success-700 ${panel ? 'text-[11px]' : 'text-xs'}`}>
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
            className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              verifiedOnly ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>
      {!panel && <hr className="mb-5 border-surface-border" />}
    </>
  );

  const moreSections = (
    <>

      {onCategoryChange && (facets?.category?.length ?? 0) > 0 && (
        <FilterSection flat={panel} defaultOpen={!panel} title="Category">
          <SingleSelectPills
            options={(facets.category ?? []).map((c) => ({ value: c.slug, label: c.name, count: c.count }))}
            selected={selectedCategory}
            onChange={onCategoryChange}
          />
        </FilterSection>
      )}

      {onCountryChange && (facets?.country?.length ?? 0) > 0 && (
        <FilterSection flat={panel} defaultOpen={!panel} title="Supplier country">
          <SingleSelectPills
            options={(facets.country ?? []).map((c) => ({
              value: c.value,
              label: countryNameOf(c.value) ?? c.value,
              count: c.count,
            }))}
            selected={selectedCountry}
            onChange={onCountryChange}
          />
        </FilterSection>
      )}

      {showPrice && (
      <FilterSection
        flat={panel}
        collapsible={!panel}
        title={`Price${facets?.price?.currency ? ` (${facets.price.currency})` : ''}`}
      >
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
      )}

      {loading ? (
        <div className={panel ? 'space-y-3 px-4 py-4' : 'space-y-3 border-t border-surface-border pt-4'}>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-4/5" />
        </div>
      ) : (
        usefulAttributes.map((attr) => (
          <FilterSection
            key={attr.key}
            flat={panel}
            collapsible={!panel}
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
    </>
  );

  if (panel) {
    return (
      <div className="overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
        <div className="flex items-center justify-between gap-2 border-b border-surface-border px-4 py-3.5">
          <h2 className="text-[15px] font-bold text-ink-900">Filters</h2>
          {appliedChips.length > 0 && (
            <button type="button" onClick={onClearAll} className="text-sm font-medium text-primary-700 hover:underline">
              Clear all
            </button>
          )}
        </div>
        {alwaysVisible}
        {/* Owner, 2026-08-17: the collapsed Price/GSM/Width ROWS were still
            visible and they wanted them hidden too — so the whole set lives
            behind ONE disclosure and only Verified sellers shows at rest. It
            opens itself when any of those filters is active, so a hidden
            panel can never conceal why results are narrowed. */}
        {(showPrice || usefulAttributes.length > 0 || loading) && (
          <>
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left text-sm font-semibold text-ink-900 transition-colors hover:text-primary-700"
        >
          {moreOpen ? 'Hide filters' : 'More filters'}
          <ChevronDownIcon className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
        </button>
        {moreOpen && <div className="border-t border-surface-border">{moreSections}</div>}
          </>
        )}
      </div>
    );
  }

  return (
    <div className={bare ? 'p-4' : cardCls}>
      {alwaysVisible}
      {moreSections}
    </div>
  );
}

/** One collapsible section — bold heading + chevron (rotates open, same
 *  convention as `Combobox`'s own toggle) + content. Open by default; purely
 *  a display state, never affects which filters are active. */
/** `collapsible={false}` (owner, 2026-08-17) is how the rail renders: the ONE
 *  "More filters" disclosure is the only collapse there, so the groups behind
 *  it are plain sections — a heading and its controls, no second chevron to
 *  fight. The drawer keeps its own per-group toggles. */
function FilterSection({ title, children, flat = false, collapsible = true }) {
  const [open, setOpen] = useState(true);
  const shown = collapsible ? open : true;
  const headingCls = flat ? 'text-[15px] font-bold text-ink-900' : 'text-lg font-bold text-primary-800';
  return (
    <div
      className={
        // `flat` = inside the unified rail panel: a hairline-divided row, NOT
        // its own card (the card-per-group version read as floating boxes).
        flat
          ? 'border-b border-surface-border px-4 py-3.5 last:border-b-0'
          : 'border-b border-surface-border pb-5 pt-5 first-of-type:pt-0 last:border-b-0 last:pb-0'
      }
    >
      {collapsible ? (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 text-left">
          <span className={headingCls}>{title}</span>
          <ChevronDownIcon
            className={`shrink-0 transition-transform ${flat ? 'h-4 w-4 text-ink-400' : 'h-5 w-5 text-muted'} ${open ? 'rotate-180' : ''}`}
          />
        </button>
      ) : (
        <h3 className={headingCls}>{title}</h3>
      )}
      {shown && <div className={flat ? 'mt-3' : 'mt-4'}>{children}</div>}
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

/** SINGLE-select pill row (`/search`'s category + country groups — the API
 *  takes ONE value for each): picking a pill replaces the selection, picking
 *  the selected pill clears it. Same pill anatomy as `AttrOptionPills`. */
function SingleSelectPills({ options, selected, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded
    ? options
    : (() => {
        const head = options.slice(0, OPTIONS_SHOW_LIMIT);
        const missingSelected = options
          .slice(OPTIONS_SHOW_LIMIT)
          .filter((o) => o.value === selected);
        return [...head, ...missingSelected];
      })();
  const hiddenCount = options.length - visible.length;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {visible.map((opt) => {
          const checked = opt.value === selected;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(checked ? null : opt.value)}
              title={`${opt.count} match${opt.count === 1 ? '' : 'es'}`}
              aria-pressed={checked}
              aria-label={`${opt.label}, ${opt.count} match${opt.count === 1 ? '' : 'es'}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                checked
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-surface-border bg-white text-ink-700 hover:border-primary-600 hover:text-primary-700'
              }`}
            >
              {checked ? <CheckIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
              {opt.label}
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
 *  thing. Exported so `/search` can render the identical chip row directly on
 *  the page (not only inside this component's own drawer body) — the AI
 *  search results treatment needs a visible "what did AI apply" row, and
 *  reusing this is more honest than a second, parallel chip implementation
 *  that could disagree with the drawer's. */
export function buildAppliedChips({
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
  selectedCategory,
  onCategoryChange,
  categoryFacet,
  selectedCountry,
  onCountryChange,
  countryName,
  moqMin,
  onMoqChange,
}) {
  const chips = [];
  if (verifiedOnly) {
    chips.push({ id: 'verified', label: 'Verified sellers', onRemove: onToggleVerified });
  }
  if (selectedCategory && onCategoryChange) {
    const cat = (categoryFacet ?? []).find((c) => c.slug === selectedCategory);
    chips.push({
      id: 'category',
      // The server now pins a selected leaf into the facet even at count 0, so
      // the real name is normally here. The fallback un-slugs rather than
      // printing "silk-fabric" at the buyer (owner screenshot, 2026-08-17).
      label: cat?.name ?? selectedCategory.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      onRemove: () => onCategoryChange(null),
    });
  }
  if (selectedCountry && onCountryChange) {
    chips.push({
      id: 'country',
      label: countryName?.(selectedCountry) ?? selectedCountry,
      onRemove: () => onCountryChange(null),
    });
  }
  if (priceMin || priceMax) {
    const label = `${priceCurrency ?? ''} ${priceMin || '0'} – ${priceMax || 'any'}`.trim();
    chips.push({ id: 'price', label, onRemove: () => onPriceChange(null, null) });
  }
  if (moqMin && onMoqChange) {
    chips.push({ id: 'moq', label: `MOQ ${moqMin}+`, onRemove: () => onMoqChange(null) });
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
