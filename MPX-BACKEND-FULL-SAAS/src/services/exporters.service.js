import { Organisation } from '../models/Organisation.js';
import { AppError } from '../utils/AppError.js';
import { idOrSlugFilter } from '../utils/idOrSlug.js';

// Public exporter profile (B7). An exporter is publicly visible from signup — its
// visibility is NEVER gated on verification. A21: this is a HAS-a-side check —
// `exporterSide: true` (so an org without an exporter side can't be read via a
// guessed id), plus `isActive` (a deactivated org is 404). A rejected/pending
// exporter is still public; only its "verified" flag differs.
//
// Accepts an id OR a slug: SEO §1 serves the public seller page at
// `/supplier/:slug`, so the frontend fetches by slug while internal callers hold
// ids. Product and Category detail reads already work this way.
export async function getPublicExporter({ idOrSlug }) {
  const org = await Organisation.findOne({
    ...idOrSlugFilter(idOrSlug),
    exporterSide: true,
    isActive: true,
  });
  if (!org) throw AppError.notFound('exporter not found', 'Not found.');
  return org;
}
