import { toPublic } from '../utils/toPublic.js';
import { publicProductView } from './publicProduct.view.js';
import {
  PUBLIC_FIELDS as CATEGORY_PUBLIC_FIELDS,
  PUBLIC_DERIVED as CATEGORY_PUBLIC_DERIVED,
} from '../models/Category.js';
import {
  PUBLIC_FIELDS as ORG_PUBLIC_FIELDS,
  PUBLIC_DERIVED as ORG_PUBLIC_DERIVED,
} from '../models/Organisation.js';

/**
 * FINALIZE F5b — landing content projections.
 *
 * The featured card for a product / category / supplier is EXACTLY the same
 * public projection those entities already have elsewhere (`toPublic()` over the
 * model-declared `PUBLIC_FIELDS`). Nothing richer, nothing extra: a landing card
 * is not a place to widen the public surface, and hand-rolling an object literal
 * here is the bug the shared serialiser exists to prevent.
 *
 * The only new public fields on this route are the banner's own presentation
 * (image, title, subtitle, linkUrl) plus `order` — all of them content an admin
 * typed for publication.
 */

/** Banner — the one kind with no underlying entity. */
function bannerView(row) {
  return {
    id: String(row._id),
    image: row.image ?? null,
    title: row.title ?? null,
    subtitle: row.subtitle ?? null,
    linkUrl: row.linkUrl ?? null,
    order: row.order ?? 0,
  };
}

/**
 * Compose the landing response. A featured row whose target did not resolve is
 * DROPPED here rather than rendered as a null card — the page shows one fewer
 * tile, which is the correct behaviour when a product was taken down or its
 * company blocked.
 */
export function landingFeaturedView({ byKind, products, categories, suppliers }) {
  return {
    banners: byKind.banner.map(bannerView),

    products: byKind.product
      .map((row) => {
        const product = products?.byId.get(String(row.targetId));
        if (!product) return null;
        return { id: String(row._id), order: row.order ?? 0, product: publicProductView(product, products.context) };
      })
      .filter(Boolean),

    categories: byKind.category
      .map((row) => {
        const category = categories?.get(String(row.targetId));
        if (!category) return null;
        return {
          id: String(row._id),
          order: row.order ?? 0,
          category: toPublic(category, {
            fields: CATEGORY_PUBLIC_FIELDS,
            derived: CATEGORY_PUBLIC_DERIVED,
          }),
        };
      })
      .filter(Boolean),

    suppliers: byKind.supplier
      .map((row) => {
        const org = suppliers?.byId.get(String(row.targetId));
        if (!org) return null;
        return {
          id: String(row._id),
          order: row.order ?? 0,
          supplier: {
            ...toPublic(org, { fields: ORG_PUBLIC_FIELDS, derived: ORG_PUBLIC_DERIVED }),
            // Whitelisted (m3-public-projection §9b): LIVE listings only. Async
            // by nature, so it rides next to toPublic() rather than inside the
            // sync PUBLIC_DERIVED — the same shape as the seller profile.
            productCount: suppliers.countById.get(String(org._id)) ?? 0,
          },
        };
      })
      .filter(Boolean),
  };
}

/**
 * Admin row. Carries the curation state the public view has no reason to show —
 * the schedule, the on/off switch, and whether the target still resolves — but
 * never `publicId` (select:false; the Cloudinary asset id is internal).
 */
export function adminFeaturedView(row) {
  return {
    id: String(row._id),
    kind: row.kind,
    targetId: row.targetId ? String(row.targetId) : null,
    image: row.image ?? null,
    title: row.title ?? null,
    subtitle: row.subtitle ?? null,
    linkUrl: row.linkUrl ?? null,
    order: row.order ?? 0,
    active: row.active,
    startsAt: row.startsAt ?? null,
    endsAt: row.endsAt ?? null,
    createdAt: row.createdAt ?? null,
    // Admin-only pointer resolution (M6 §3): what the row points at, and whether
    // it currently qualifies for the landing page. A banner is its own content.
    // `target` is identity only — name/slug/image — never a wider projection.
    target: row._target ?? null,
    targetLive: row.kind === 'banner' ? true : Boolean(row._targetLive),
  };
}
