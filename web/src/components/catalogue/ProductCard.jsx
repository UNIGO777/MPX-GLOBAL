import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext.jsx';
import { countryName } from '../../lib/countries.js';
import { VerifiedTick } from '../ui/VerifiedTick.jsx';
import { EnquiryIcon } from '../ui/icons.jsx';
import { SaveButton } from '../saved/SaveButton.jsx';
import { ProductImage } from './ProductImage.jsx';
import { PriceLine } from './PriceLine.jsx';
import { monogramTone } from '../chat/CompanyAvatar.jsx';

/**
 * The public product card — every listing surface renders this one (landing,
 * search, AI search, category, related, featured, and the seller's own form
 * preview).
 *
 * REDESIGNED 2026-09-24 to the owner's "trade data" mockup: the card now carries
 * a MINI TABLE — MOQ / lead time / origin for goods, engagement / timeline /
 * origin for services — plus a direct **Send enquiry** button, so a bulk buyer
 * can compare terms across a grid without opening four tabs.
 *
 * 🔴 Two things in that mockup were deliberately NOT built:
 *
 *  1. A **"Verification pending" chip** beside a seller's name. There is no
 *     "not verified" badge anywhere in this product — the ABSENCE of the tick is
 *     the only signal (CLAUDE.md "Roles", `web-design.md`). A pending chip also
 *     leaks review state onto a public surface, which the projection exists to
 *     prevent.
 *  2. **`EnquiryButton` on the card.** It runs a per-product query to find an
 *     existing thread; on a 20-card grid that is 20 requests per page for every
 *     signed-in buyer. The button here NAVIGATES to the product with
 *     `?enquire=1`, which that page already honours by opening the form — the
 *     same mechanism the return-from-sign-in path uses. No extra request, and
 *     the label stays true.
 *
 * 🔴 NO STATUS CHIP. `status`, `takedown` and raw verification state never
 * appear here; only `active` products are queryable at all.
 *
 * `to` is OPTIONAL and deliberately so: omit it and the card renders static —
 * no dead anchors and no enquiry button (`web-ui-notes.md`), which is what the
 * seller's form preview needs, since that product does not exist yet. Every
 * field is GUARDED: the preview feeds a partial product.
 */
function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

/**
 * The mini table. Goods and services ask different questions, so they get
 * different rows — mirroring the split `Product` itself uses.
 *
 * Empty cells are DROPPED, never rendered as a dash: a seller who left lead time
 * blank should not make the card look broken. With nothing filled the table does
 * not render at all.
 */
function tradeCells(product) {
  const isService = product.category?.type === 'service';
  const origin = product.countryOfOrigin
    ? (countryName(product.countryOfOrigin) ?? product.countryOfOrigin)
    : null;

  const cells = isService
    ? [
        ['Engagement', product.engagementType],
        ['Timeline', product.timeline],
        ['Origin', origin],
      ]
    : [
        [
          'MOQ',
          product.moq != null
            ? `${product.moq.toLocaleString()}${product.unit ? ` ${product.unit}` : ''}`
            : null,
        ],
        ['Lead time', product.leadTime],
        ['Origin', origin],
      ];

  return cells.filter(([, value]) => value != null && value !== '');
}

export function ProductCard({ product, showSeller = true, to }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const cover = product.images?.[0];
  const seller = product.seller;
  const cells = tradeCells(product);
  const isService = product.category?.type === 'service';

  /**
   * Who is not offered the button, matching `EnquiryButton`'s own rule so the
   * two surfaces never disagree: an exporter account, platform staff, and a
   * buyer looking at their own company's listing. Cheap here — it reads the
   * session already in context and makes no request.
   */
  const ownProduct = Boolean(user?.orgId) && user?.orgId === seller?.id;
  const canEnquire =
    Boolean(to) && user?.role !== 'exporter' && user?.role !== 'employee' && user?.role !== 'superadmin' && !ownProduct;

  const inner = (
    <>
      <div className="relative overflow-hidden">
        {/* WHOLE photo on a blurred copy of itself — a portrait shot must not
            have its subject cropped away by a 4:3 frame. See ProductImage. */}
        <ProductImage
          src={cover}
          alt=""
          ratio="aspect-[4/3]"
          className="w-full"
          imgClassName="transition-transform duration-300 group-hover:scale-105"
        />
        {/* Services look nothing like goods in a mixed grid, and the photo alone
            does not say which is which. Goods get no badge — they are the norm,
            and badging both would be noise. */}
        {isService && (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-ink-900/85 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Service
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        {product.category?.name && (
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-primary-700">
            {product.category.name}
          </p>
        )}

        <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-ink-900">
          {product.name}
        </h3>

        {/* mt-auto: the price and the table sit at the card's foot, so a
            one-line and a two-line name still align across a row. */}
        <div className="mt-auto pt-2.5">
          <PriceLine price={product.price} unit={product.unit} size="base" />
        </div>

        {cells.length > 0 && (
          <dl className="mt-2.5 grid grid-cols-3 divide-x divide-surface-border overflow-hidden rounded-lg border border-surface-border bg-surface-subtle">
            {cells.map(([label, value]) => (
              <div key={label} className="min-w-0 px-2 py-1.5">
                <dt className="truncate text-[9px] font-medium uppercase tracking-wide text-muted">
                  {label}
                </dt>
                <dd className="truncate text-[11px] font-semibold text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {showSeller && seller ? (
          <div className="mt-2.5 flex items-center gap-2">
            {/* No `border-t` any more: the trade strip directly above already
                separates this row, and a second rule made the card read as three
                stacked boxes. */}
            {/* The company's LOGO when it has one (owner, 2026-09-24: "logo not
                visible") — `logo` is already on the public organisation
                whitelist; initials, in the company's own tint, otherwise. */}
            {seller.logo ? (
              <img
                src={seller.logo}
                alt=""
                loading="lazy"
                className="h-6 w-6 shrink-0 rounded-full bg-white object-contain p-0.5 ring-1 ring-inset ring-ink-200"
              />
            ) : (
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ring-1 ring-inset ${monogramTone(seller.name)}`}
              >
                {initials(seller.name)}
              </span>
            )}
            <span className="min-w-0 truncate text-xs font-medium text-ink-800">{seller.name}</span>
            {/* Tick or nothing. There is no pending/unverified counterpart. */}
            <VerifiedTick verified={seller.verified} compact />
          </div>
        ) : null}
      </div>
    </>
  );

  const shell =
    'group relative flex h-full flex-col overflow-hidden rounded-xl border border-surface-border bg-white shadow-card transition-all';

  // Save heart — rendered OUTSIDE the Link: a <button> inside an <a> is invalid
  // and would fight the card's own navigation. Guarded, because the form preview
  // feeds a partial product with no id.
  const heart = product.id ? (
    <SaveButton targetId={product.id} name={product.name} className="z-10" />
  ) : null;

  // Same reason the heart sits outside the Link. Navigating (rather than opening
  // a modal from here) is what keeps the grid free of per-card requests.
  const enquire = canEnquire ? (
    <button
      type="button"
      onClick={() => navigate(`${to}?enquire=1`)}
      className="flex w-full items-center justify-center gap-2 border-t border-surface-border bg-primary-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300"
    >
      <EnquiryIcon className="h-3.5 w-3.5" aria-hidden="true" />
      Send enquiry
    </button>
  ) : null;

  if (!to)
    return (
      <li className={shell}>
        {inner}
        {heart}
      </li>
    );

  return (
    // Hover lives on the <li>, because the border does. It used to sit on the
    // <Link>, which no longer owns the card's edge.
    <li className={`${shell} hover:border-primary-600 hover:shadow-lift`}>
      <Link to={to} className="flex flex-1 flex-col">
        {inner}
      </Link>
      {heart}
      {enquire}
    </li>
  );
}
