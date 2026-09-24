import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext.jsx';
import { countryName } from '../../lib/countries.js';
import { VerifiedTick } from '../ui/VerifiedTick.jsx';
import { EnquiryIcon } from '../ui/icons.jsx';
import { SaveButton } from '../saved/SaveButton.jsx';
import { ProductImage } from './ProductImage.jsx';
import { PriceLine } from './PriceLine.jsx';

/**
 * Horizontal list-card — search results and `/category/:slug` on desktop.
 *
 * REBUILT 2026-09-24 to the owner's "list view" mockup: photo left, specs in the
 * middle, and the numbers plus BOTH actions in a dedicated right-hand column, so
 * a buyer scanning a page of results can compare terms down a single edge
 * instead of hunting each card.
 *
 * 🔴 Two things in that mockup do not exist and were NOT invented:
 *
 *  1. **A city under the seller ("Tirupur").** Only `country` is in the public
 *     organisation projection — a seller's town is private
 *     (`m3-public-projection.md`). Country renders instead.
 *  2. **A "Verification pending" chip.** There is no "not verified" badge
 *     anywhere in this product: the ABSENCE of the tick is the only signal
 *     (CLAUDE.md "Roles", `web-design.md`), and a pending chip would publish
 *     review state.
 *
 * The enquiry button NAVIGATES with `?enquire=1`, which the product page already
 * honours by opening the form. It deliberately does not mount `EnquiryButton`:
 * that runs a per-product query for an existing thread, and a list of 20 rows
 * would fire 20 requests for every signed-in buyer.
 */
export function ProductListCard({ product, to }) {
  const { user, restoring } = useAuth();
  const navigate = useNavigate();

  const cover = product.images?.[0];
  const seller = product.seller;
  const isService = product.category?.type === 'service';

  /** First three short attribute values — the differentiators, as chips. */
  const chips = (product.attributes ?? [])
    .filter((a) => a && a.value != null && a.value !== '' && typeof a.value !== 'boolean')
    .map((a) => (typeof a.value === 'number' ? `${a.value} ${a.key.replace(/_/g, ' ')}` : String(a.value)))
    .filter((c) => c.length <= 28)
    .slice(0, 3);

  // Mirrors `EnquiryButton`'s own rule so the two surfaces never disagree:
  // no exporter account, no platform staff, not your own company's listing.
  const ownProduct = Boolean(user?.orgId) && user?.orgId === seller?.id;
  // Not while the session is restoring: the same-sized fallback link shows until
  // we know the viewer, so an exporter never sees "Send enquiry" flash.
  const canEnquire =
    !restoring &&
    Boolean(to) &&
    user?.role !== 'exporter' &&
    user?.role !== 'employee' &&
    user?.role !== 'superadmin' &&
    !ownProduct;

  const facts = [
    [
      'MOQ',
      product.moq != null
        ? `${product.moq.toLocaleString()}${product.unit ? ` ${product.unit}` : ''}`
        : null,
    ],
    ['Lead time', isService ? product.timeline : product.leadTime],
  ].filter(([, v]) => v != null && v !== '');

  return (
    <li>
      <article className="group/card flex flex-col overflow-hidden rounded-xl border border-surface-border bg-white shadow-card transition-all hover:-translate-y-0.5 hover:border-primary-600 hover:shadow-lift md:flex-row">
        {/* 🔴 `md:aspect-[4/3]`, NOT `md:h-auto` (fixed 2026-09-23 — owner: "why
            is this card too much bigger than the others"). With `h-auto` the
            `md:h-full` below became a percentage height against an auto-height
            parent, which CSS resolves to the image's OWN natural height: one
            portrait photo made its row twice the height of every other card. An
            aspect ratio derives a definite height from the width, so rows match
            whatever shape the seller uploaded. It still STRETCHES when the text
            column is taller — flex `align-items: stretch` wins over the ratio. */}
        <div className="relative w-full shrink-0 md:aspect-[4/3] md:w-[220px] lg:w-[200px] xl:w-[150px] 2xl:w-[190px]">
          {/* Whole photo on a blurred copy — see ProductImage. `ratio` carries
              the HEIGHT rather than an aspect ratio here: the column above
              already owns the shape (`md:aspect-[4/3]`, and it stretches when
              the text side is taller), so this just fills it. */}
          <ProductImage src={cover} alt="" ratio="h-56 md:h-full" className="w-full" />
          {isService && (
            <span className="absolute left-3 top-3 rounded-md bg-ink-900/85 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              Service
            </span>
          )}
        </div>

        {/* min-w-0 is load-bearing: without it flexbox `min-width: auto` lets a
            long chip's min-content width push this column past the card edge. */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
          {product.category?.name && (
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-primary-700">
              {product.category.name}
            </p>
          )}

          <Link to={to} className="text-lg font-bold leading-snug text-ink-900 hover:text-primary-700 hover:underline">
            {product.name}
          </Link>

          {chips.length > 0 && (
            <p className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-surface-subtle px-2.5 py-1 text-[11px] font-medium text-ink-700"
                >
                  {c}
                </span>
              ))}
            </p>
          )}

          {seller && (
            <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span className="truncate font-medium text-ink-800">{seller.name}</span>
              {/* Tick or nothing — there is no unverified counterpart. */}
              <VerifiedTick verified={seller.verified} compact />
              {seller.country && (
                <>
                  <span aria-hidden="true">·</span>
                  {/* COUNTRY, never a city — see the header note. */}
                  <span>{countryName(seller.country) ?? seller.country}</span>
                </>
              )}
            </p>
          )}
        </div>

        {/* The actions column. Fixed width so price, MOQ and both buttons line
            up down the page — that alignment is the point of a list view.
            ⚠️ It went ink-800 and back on 2026-09-24; now a LIGHT RED wash
            (`primary-50`), owner's call. It still separates the deal from the
            description without a dark slab, and the button keeps its punch —
            #CE061A on #FFF0F1 is a wide gap, so the fill never gets lost in
            its own tint. */}
        <div className="flex w-full shrink-0 flex-col gap-2.5 border-t border-primary-100 bg-primary-50 p-4 md:w-[230px] xl:w-[180px] 2xl:w-[210px] md:border-l md:border-t-0">
          <PriceLine price={product.price} unit={product.unit} size="base" />

          {facts.length > 0 && (
            <dl className="space-y-0.5 text-[12px] text-muted">
              {facts.map(([label, value]) => (
                <div key={label} className="flex gap-1.5">
                  <dt>{label}</dt>
                  <dd className="min-w-0 truncate font-semibold text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-auto flex flex-col gap-2 pt-2">
            {canEnquire ? (
              <button
                type="button"
                onClick={() => navigate(`${to}?enquire=1`)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white transition-colors group-hover/card:bg-primary-500 hover:!bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                <EnquiryIcon className="h-4 w-4" aria-hidden="true" />
                Send enquiry
              </button>
            ) : (
              /* Red, matching the enquiry button it stands in for — the two are
                 never shown together (this is the fallback for anyone who
                 cannot enquire: exporter account, staff, own listing), so the
                 rail always leads with one red primary action and the black
                 Save sits under it. */
              <Link
                to={to}
                className="flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white transition-colors group-hover/card:bg-primary-500 hover:!bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
              >
                View details
              </Link>
            )}
            {product.id && <SaveButton targetId={product.id} name={product.name} variant="labelled" />}
          </div>
        </div>
      </article>
    </li>
  );
}
