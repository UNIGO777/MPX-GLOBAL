import { Link } from 'react-router-dom';

import { countryName } from '../../lib/countries.js';
import { VerifiedTick } from '../ui/VerifiedTick.jsx';
import { NoImagePanel } from './NoImagePanel.jsx';
import { PriceLine } from './PriceLine.jsx';

/**
 * The public product card — screens 2, 3 (related) and 4 all render this one.
 *
 * REDESIGNED 2026-08-11 (owner: "not a good way to present the product") into a
 * B2B MERCHANDISING card. The list projection is rich, so the card now earns
 * its space with what a buyer actually decides on:
 *
 *   photo    → 4:3, zoom on hover, "View details" bar slides up (desktop).
 *   name     → two-line clamp.
 *   specs    → the first two attribute VALUES as chips ("100% cotton",
 *              "400 gsm") — the differentiators, right on the card.
 *   price    → the hero, with /unit; MOQ beneath it — the first question every
 *              B2B buyer asks.
 *   seller   → monogram · name · verified tick · country, on a hairline.
 *
 * 🔴 NO STATUS CHIP. This is a public surface: `status`, `takedown` and raw
 * verification state never appear here, and only `active` products are
 * queryable at all. The seller's own list uses a different, private variant.
 *
 * `showSeller={false}` on the supplier profile (every card shares one seller)
 * and the seller's own form preview — those show the category line instead.
 *
 * `to` is OPTIONAL and deliberately so: omit it and the card renders static
 * (no dead anchors — web-ui-notes.md); pass it and the whole card is one
 * target. Every field is GUARDED — the form preview feeds a partial product.
 */
function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

/**
 * First two SHORT attribute values — strings as-is, numbers with key. Long
 * phrase values are skipped entirely (owner screenshot: "platform engi…" —
 * a chip that needs an ellipsis was never chip material).
 */
function specChips(attributes = []) {
  return attributes
    .filter((a) => a && a.value != null && a.value !== '' && typeof a.value !== 'boolean')
    .map((a) => (typeof a.value === 'number' ? `${a.value} ${a.key}` : String(a.value)))
    .filter((c) => c.length <= 26)
    .slice(0, 2);
}

export function ProductCard({ product, showSeller = true, to }) {
  const cover = product.images?.[0];
  const seller = product.seller;
  const chips = specChips(product.attributes);

  const inner = (
    <>
      <div className="relative overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            width={640}
            height={480}
            className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <NoImagePanel ratio="aspect-[4/3]" />
        )}
        {to && (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 translate-y-full bg-ink-900/80 py-2 text-center text-xs font-semibold text-white transition-transform duration-300 group-hover:translate-y-0"
          >
            View details
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink-900">
          {product.name}
        </h3>

        {chips.length === 0 && showSeller && product.category?.name && (
          <p className="mt-1.5 text-xs text-muted">{product.category.name}</p>
        )}
        {chips.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c}
                className="rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-medium text-ink-600"
              >
                {c}
              </span>
            ))}
          </p>
        )}

        {/* mt-auto: price + everything under it sits at the card's foot, so a
            one-line and a two-line name still align across a row. */}
        <div className="mt-auto pt-2.5">
          <PriceLine price={product.price} unit={product.unit} size="base" />
          {product.moq != null && (
            <p className="mt-0.5 text-xs text-muted">
              MOQ {product.moq.toLocaleString()}{product.unit ? ` ${product.unit}` : ''}
            </p>
          )}
        </div>

        {showSeller && seller ? (
          <div className="mt-2.5 flex items-center gap-2 border-t border-surface-border pt-2.5">
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[9px] font-bold text-primary-700"
            >
              {initials(seller.name)}
            </span>
            <span className="min-w-0 truncate text-xs font-medium text-ink-800">{seller.name}</span>
            <VerifiedTick verified={seller.verified} compact />
            {seller.country && (
              <span className="ml-auto shrink-0 text-[10px] text-muted">
                {countryName(seller.country) ?? seller.country}
              </span>
            )}
          </div>
        ) : (
          product.category?.name && (
            <span className="mt-2.5 border-t border-surface-border pt-2.5 text-xs text-ink-500">
              {product.category.name}
            </span>
          )
        )}
      </div>
    </>
  );

  const shell =
    'group flex h-full flex-col overflow-hidden rounded-xl border border-surface-border bg-white shadow-card transition-all';

  if (!to) return <li className={shell}>{inner}</li>;

  return (
    <li className="h-full">
      <Link to={to} className={`${shell} hover:border-primary-600 hover:shadow-lift`}>
        {inner}
      </Link>
    </li>
  );
}
