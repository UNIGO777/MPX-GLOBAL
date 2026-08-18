import { Link } from 'react-router-dom';

import { countryName } from '../../lib/countries.js';
import { formatMonth } from '../../lib/format.js';
import { VerifiedTick } from '../ui/VerifiedTick.jsx';
import { SaveButton } from '../saved/SaveButton.jsx';
import { NoImagePanel } from './NoImagePanel.jsx';
import { PriceLine } from './PriceLine.jsx';

/**
 * Horizontal list-card for `/category/:slug` (2026-08-11, owner: match the
 * reference mockup "exact same... the product cards also" — the owner sent
 * the mockup's literal HTML/Tailwind source on this pass).
 *
 * 🔴 A NEW, PAGE-SCOPED component — deliberately NOT a change to the shared
 * `ProductCard.jsx` (used on `/product/:slug`'s "More in this category" row
 * and `/supplier/:slug`'s grid, neither asked for here, and both would suit
 * a horizontal card badly at 4-up). `ProductCard.jsx` is also the subject of
 * a SEPARATE, still-open decision (`web-product-card-redesign-prompt.md`,
 * "5+ premium directions to choose from") — this file doesn't preempt that.
 *
 * The mockup's layout, our real data — three things it has that don't map to
 * anything real, handled three different ways:
 *   - "FEATURED" ribbon, "N enterprises contacted this week" — 100%
 *     FABRICATED (a claimed count with no real number behind it, on a
 *     platform that doesn't track or show that metric anywhere). No honest
 *     way to render these at all — OMITTED, not just hidden.
 *   - Heart/save icon — a REAL, shipped, buyer-only endpoint exists
 *     (`POST/DELETE /saved`) but wiring auth-gating + optimistic UI wasn't
 *     asked for in this pass. Shown in the exact position, disabled, not
 *     hidden and not fake-functional — logged in docs/UiWebNotes.md.
 *   - "Inquiry" button — shipped disabled for mockup fidelity, then REMOVED
 *     on 2026-08-17 when M4 wired chat: the product page's enquiry button is
 *     the single door (owner's ruling), and every card links there already.
 *
 * Real stat row: Price (hero) · MOQ · the product's lead spec/attribute value
 * — three divided columns, the honest equivalent of the mockup's three
 * divided figures. Footer: seller + country + verified tick, "Listed
 * {month year}" (real `listedSince`).
 */
export function ProductListCard({ product, to }) {
  const cover = product.images?.[0];
  const seller = product.seller;
  const leadAttr = (product.attributes ?? []).find(
    (a) => a && a.value != null && a.value !== '' && typeof a.value !== 'boolean',
  );

  return (
    <li>
      {/* Horizontal from md (the page's 2-up compact grid covers <md). The
          image column SCALES with the room the layout leaves: md has the full
          width, lg loses 280px to the rail, xl+ earns it back
          (responsive audit, 2026-08-14). */}
      <article className="flex flex-col overflow-hidden rounded-xl border border-surface-border bg-white shadow-card transition-shadow hover:shadow-lift md:flex-row">
        <div className="relative w-full shrink-0 md:h-auto md:w-[320px] lg:w-[300px] xl:w-[360px] 2xl:w-[400px]">
          {cover ? (
            <img src={cover} alt="" loading="lazy" className="h-64 w-full object-cover md:h-full" />
          ) : (
            <NoImagePanel ratio="h-64 md:h-full" className="w-full" />
          )}
          {/* Save/favourite — LIVE since 2026-08-16 (M3 Phase 5). Visible to
              everyone; buyer toggles, anyone else gets the gate modal. */}
          <SaveButton targetId={product.id} name={product.name} className="right-4 top-4" />
        </div>

        {/* p-4 / my-2 / pt-2.5 (2026-08-14, owner: "reduce the height", then
            "a bit more") — ~45px total trim off the desktop card. min-w-0 is
            load-bearing: without it flexbox min-width:auto lets the stat
            row's min-content width inflate the column past the card edge at
            lg (Inquiry button rendered half-clipped). */}
        <div className="flex min-w-0 flex-1 flex-col p-4">
          <div>
            <Link to={to} className="text-xl font-bold text-primary-800 hover:underline">
              {product.name}
            </Link>
            {/* flex-wrap: in the narrow lg column the VERIFIED tick used to
                push past the card's clipped edge (responsive audit,
                2026-08-14). */}
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
              {product.category?.name}
              {seller?.verified && (
                <>
                  <span aria-hidden="true">•</span>
                  <VerifiedTick verified compact />
                  <span className="text-xs font-semibold uppercase tracking-wide text-success">Verified</span>
                </>
              )}
            </p>
          </div>

          <div className="my-2 flex flex-wrap gap-x-8 gap-y-4">
            <div>
              <PriceLine price={product.price} unit={product.unit} size="lg" />
            </div>
            {product.moq != null && (
              <div className="border-l border-surface-border pl-8">
                <p className="text-lg font-bold text-ink-900">
                  {product.moq.toLocaleString()}
                  {product.unit ? ` ${product.unit}` : ''}
                </p>
                <p className="text-sm text-muted">Minimum order</p>
              </div>
            )}
            {leadAttr && (
              /* flex-1 + min-w + truncate keep this BESIDE the price: as a
                 rigid block, a long value ("Cloud migration & platform
                 engineering") wrapped the whole block under the price while
                 short ones sat beside it — inconsistent card to card (owner
                 screenshot, 2026-08-14). */
              <div className="min-w-[180px] flex-1 border-l border-surface-border pl-8">
                <p className="truncate text-lg font-bold text-ink-900">
                  {typeof leadAttr.value === 'number' ? `${leadAttr.value}${leadAttr.unit ? ` ${leadAttr.unit}` : ''}` : String(leadAttr.value)}
                </p>
                {/* Keys are snake_case identifiers (service_type) — humanise
                    for display, never show the raw key (2026-08-14). */}
                <p className="text-sm capitalize text-muted">{leadAttr.key.replace(/_/g, ' ')}</p>
              </div>
            )}
          </div>

          {product.description && (
            <p className="mb-2 line-clamp-2 text-sm text-muted">{product.description}</p>
          )}

          {/* `flex-col` on mobile — was a single `flex items-center
              justify-between` row, which forced the info column to compress
              against the buttons' `shrink-0` at narrow widths until it wrapped
              one word per line ("Seller •" / "India" / "Listed" / "Aug" ...).
              `sm:flex-row` restores the original side-by-side layout once
              there's room for both. */}
          {/* md:flex-wrap: at lg's narrow column the shrink-0 buttons used to
              crush the seller line to one word per line — wrapping drops the
              buttons under it instead (responsive audit, 2026-08-14). */}
          <div className="mt-auto flex flex-col gap-3 border-t border-surface-border pt-2.5 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4">
            <div className="text-sm text-muted">
              {seller?.country ? `Seller • ${countryName(seller.country) ?? seller.country}` : 'Seller'}
              {product.listedSince && <br />}
              {product.listedSince && (
                <span className="font-medium text-ink-900">Listed {formatMonth(product.listedSince)}</span>
              )}
              {seller?.name && (
                <>
                  {product.listedSince ? ' · ' : <br />}
                  <span className="font-medium text-ink-900">{seller.name}</span>
                </>
              )}
            </div>
            {/* 🔴 The card's "Inquiry" button was REMOVED with M4
                (2026-08-17, owner's 2026-08-14 ruling). The product page's
                enquiry button is the ONE door into chat (M4-4), and every card
                already links to that page — so nothing is lost, and a second
                entry point would have needed its own form on a list row. */}
            <div className="flex shrink-0 gap-3">
              <Link
                to={to}
                className="rounded-lg border border-surface-border px-5 py-2 text-sm font-semibold text-ink-800 hover:border-primary-600 hover:text-primary-700"
              >
                View details
              </Link>
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}
