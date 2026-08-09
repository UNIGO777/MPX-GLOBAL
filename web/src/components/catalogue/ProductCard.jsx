import { Link } from 'react-router-dom';

import { VerifiedTick } from '../ui/VerifiedTick.jsx';
import { NoImagePanel } from './NoImagePanel.jsx';
import { PriceLine } from './PriceLine.jsx';

/**
 * The public product card — screens 2, 3 (related) and 4 all render this one.
 *
 * Design (screen-02 export): cover 4:3 · name small and 2-line-clamped · the
 * PRICE as the visual hero · seller + tick · category on a hairline at the
 * bottom. The price carries `mt-auto`, which is what pins everything below the
 * name to the card's foot so cards in a row align however the name wraps.
 *
 * 🔴 NO STATUS CHIP. This is a public surface: `status`, `takedown` and raw
 * verification state never appear here, and only `active` products are
 * queryable at all. The seller's own list uses a different, private variant.
 *
 * `showSeller={false}` on the supplier profile, where every card shares one
 * seller and repeating it is noise.
 *
 * `to` is OPTIONAL and deliberately so: until screen 3 exists there is nowhere
 * to link, and `web-ui-notes.md` bans dead anchors. Omit it and the card renders
 * static; pass it and the whole card becomes one target.
 */
export function ProductCard({ product, showSeller = true, to }) {
  const cover = product.images?.[0];
  const seller = product.seller;

  const inner = (
    <>
      {cover ? (
        <img
          src={cover}
          alt=""
          loading="lazy"
          width={640}
          height={480}
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <NoImagePanel ratio="aspect-[4/3]" />
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-ink-900">{product.name}</h3>

        {/* mt-auto: the price and everything under it sit at the card's foot,
            so a one-line and a two-line name still align across a row. */}
        <div className="mt-auto pt-2">
          <PriceLine price={product.price} unit={product.unit} />
        </div>

        {showSeller && seller && (
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs text-muted">{seller.name}</span>
            <VerifiedTick verified={seller.verified} compact />
          </div>
        )}

        {product.category?.name && (
          <span className="mt-1 border-t border-surface-border pt-2 text-xs text-ink-500">
            {product.category.name}
          </span>
        )}
      </div>
    </>
  );

  const shell =
    'flex h-full flex-col overflow-hidden rounded-lg border border-surface-border bg-white shadow-card transition-colors';

  if (!to) return <li className={shell}>{inner}</li>;

  return (
    <li className="h-full">
      <Link to={to} className={`${shell} hover:border-primary-600`}>
        {inner}
      </Link>
    </li>
  );
}
