import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Organisation } from '../models/Organisation.js';
import { buildAvailabilityFilter } from './search.query.js';

/**
 * M3-F — sitemap + robots.
 *
 * Only ACTIVE, publicly-reachable entities are listed (m3-seo-rules §5/§6):
 * drafts, inactive, archived, taken-down and deactivated-category rows are
 * excluded, as are all filter/search URLs.
 *
 * URLs are absolute against PUBLIC_WEB_URL — these files describe the WEB app,
 * not this API, and a crawler reads them from the web domain (the deployment
 * reverse-proxies /sitemap.xml and /robots.txt here).
 */

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h — it is a crawler-facing full scan
const SITEMAP_MAX_URLS = 50_000; // sitemap protocol limit for a single file
const SITEMAP_WARN_AT = 45_000;
let cache = { xml: null, at: 0 };

export function invalidateSitemapCache() {
  cache = { xml: null, at: 0 };
}

const base = () => env.PUBLIC_WEB_URL.replace(/\/$/, '');

// XML-escape — a company name may legitimately contain & or '.
function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry({ loc, lastmod }) {
  const stamp = lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : '';
  return `<url><loc>${esc(loc)}</loc>${stamp}</url>`;
}

export async function buildSitemap() {
  const now = Date.now();
  const cacheable = env.NODE_ENV !== 'test';
  if (cacheable && cache.xml && now - cache.at < CACHE_TTL_MS) return cache.xml;

  const [products, tops, sellers] = await Promise.all([
    Product.find(await buildAvailabilityFilter()).select('slug updatedAt').lean(),
    Category.find({ parentId: null, active: true }).select('slug updatedAt').lean(),
    Organisation.find({ exporterSide: true, isActive: true }).select('slug updatedAt').lean(),
  ]);

  // Subs are emitted in their CANONICAL nested form only — SEO §1 defines both
  // /category/:slug and /category/:parent/:child, and listing both would be
  // duplicate content.
  const subs = await Category.find({ parentId: { $in: tops.map((t) => t._id) }, active: true })
    .select('slug parentId updatedAt')
    .lean();
  const topSlugById = new Map(tops.map((t) => [String(t._id), t.slug]));

  const entries = [
    ...products.map((p) => urlEntry({ loc: `${base()}/product/${p.slug}`, lastmod: p.updatedAt })),
    ...sellers.filter((s) => s.slug).map((s) => urlEntry({ loc: `${base()}/supplier/${s.slug}`, lastmod: s.updatedAt })),
    ...tops.map((c) => urlEntry({ loc: `${base()}/category/${c.slug}`, lastmod: c.updatedAt })),
    ...subs
      .filter((c) => topSlugById.has(String(c.parentId)))
      .map((c) =>
        urlEntry({
          loc: `${base()}/category/${topSlugById.get(String(c.parentId))}/${c.slug}`,
          lastmod: c.updatedAt,
        }),
      ),
  ];

  // The sitemap protocol caps ONE file at 50,000 URLs; past that a crawler
  // rejects the whole document. We are orders of magnitude below it today, so a
  // sitemap-index split is not built — but this must never fail silently, so it
  // warns early and loudly. If this ever fires, split by type
  // (/sitemap-products.xml, -sellers, -categories) behind a sitemap index.
  if (entries.length > SITEMAP_WARN_AT) {
    logger.warn(
      { urls: entries.length, limit: SITEMAP_MAX_URLS },
      'sitemap approaching the 50k URL limit — a sitemap-index split is now required',
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>`;
  if (cacheable) cache = { xml, at: now };
  return xml;
}

// Search and filtered URLs are crawl-budget waste and must not be indexed
// (m3-seo-rules §4/§5).
export function buildRobots() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /search',
    'Disallow: /*?q=',
    'Disallow: /*?category=',
    'Disallow: /*&',
    '',
    `Sitemap: ${base()}/sitemap.xml`,
    '',
  ].join('\n');
}
