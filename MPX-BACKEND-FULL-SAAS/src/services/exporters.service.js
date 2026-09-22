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
// 🔴 A RETIRED slug resolves here too (2026-09-22). Renaming a company moves its
// public URL, and `m3-seo.md` allows that only if the old URL keeps working:
// "keep the old one and 301-redirect old→new. Never hard-break an indexed URL."
// This lookup is the "keep working" half — the response carries the canonical
// `slug`, and the public page redirects to it (the "301" half; a client-side
// replace, since the page is client-rendered).
//
// Retired slugs are unique across orgs (see the Organisation index), so matching
// them cannot pull back two companies.
export async function getPublicExporter({ idOrSlug }) {
  const direct = idOrSlugFilter(idOrSlug);
  const org = await Organisation.findOne({
    // An id lookup stays exact; only a slug lookup falls through to retired ones.
    ...(direct._id ? direct : { $or: [direct, { previousSlugs: String(idOrSlug).toLowerCase() }] }),
    exporterSide: true,
    isActive: true,
  });
  if (!org) throw AppError.notFound('exporter not found', 'Not found.');
  return org;
}
