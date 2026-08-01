import { Router } from 'express';

import { validate } from '../middleware/validate.js';
import { publicRoute } from '../config/routeGuard.js';
import { generalLimiter, searchLimiter, aiLimiter } from '../middleware/rateLimit.js';
import { optionalAuthenticate } from '../middleware/optionalAuthenticate.js';
import * as ctrl from '../controllers/exporters.controller.js';
import * as V from '../validators/exporters.validators.js';
import * as productsCtrl from '../controllers/publicProducts.controller.js';
import * as PV from '../validators/product.validators.js';
import * as searchCtrl from '../controllers/search.controller.js';
import * as SV from '../validators/search.validators.js';
import * as seoCtrl from '../controllers/seo.controller.js';
import * as featuredCtrl from '../controllers/featured.controller.js';

export const publicRouter = Router();

// Public exporter profile (B7): visible from signup, never gated on verification.
// A full public directory/search is Module 3 — this is the single-profile read M1
// needs so the frontend can render the verified tick.
// Param accepts an id OR a slug — the public page lives at /supplier/:slug (SEO §1).
publicRouter.get(
  '/exporters/:idOrSlug',
  publicRoute,
  generalLimiter,
  validate(V.exporterIdParam),
  ctrl.getExporter,
);

// M2-F: public catalogue browse + detail (full search/facets = M3). Query-level
// availability; whitelist projections only. The `seller` filter renders the
// public seller page's catalogue.
publicRouter.get(
  '/public/products',
  publicRoute,
  generalLimiter,
  validate(PV.listPublic),
  productsCtrl.listPublic,
);
publicRouter.get(
  '/public/products/:idOrSlug',
  publicRoute,
  generalLimiter,
  validate(PV.publicIdOrSlugParam),
  productsCtrl.getPublic,
);

// FINALIZE F5b: the landing page's curated content — banners, featured products,
// featured categories, highlighted suppliers — in ONE call, so the front page
// renders in a single round trip. Every target is re-resolved through the same
// availability rules as the rest of the public surface, so a taken-down product
// or a blocked company disappears from here on its own.
publicRouter.get('/public/featured', publicRoute, generalLimiter, featuredCtrl.landing);

// M3-B: the one search surface (native $text — §A26). Guests included; login is
// only ever needed to SAVE. Its own tighter limiter (api-endpoints rule).
publicRouter.get('/public/search', publicRoute, searchLimiter, validate(SV.search), searchCtrl.search);

// Facets take the SAME params as search — counts are always "for the current
// query" (§A27.2 computes each group excluding its own selection).
publicRouter.get('/public/facets', publicRoute, searchLimiter, validate(SV.facets), searchCtrl.facets);

// M3-E: AI search. PUBLIC (guests may use it) but `optionalAuthenticate` picks
// up a signed-in caller so the limiter and the per-org daily quota can key on
// them. Never throws on a bad token — it just continues as a guest.
publicRouter.post(
  '/search/ai',
  optionalAuthenticate,
  aiLimiter,
  validate(SV.aiSearch),
  searchCtrl.aiSearch,
);

// M3-F · SEO. These describe the WEB app (absolute URLs against PUBLIC_WEB_URL)
// and are meant to be reverse-proxied from the web domain — a crawler reads
// them there, not on the API host.
publicRouter.get('/sitemap.xml', publicRoute, generalLimiter, seoCtrl.sitemap);
publicRouter.get('/robots.txt', publicRoute, generalLimiter, seoCtrl.robots);
