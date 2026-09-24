/**
 * How many featured items of each kind the landing page actually SHOWS.
 *
 * One table read by both sides of the feature: the landing page slices with it,
 * and `/admin/featured` uses it to mark a live slot past the limit as "not
 * shown" instead of calling it Live. Two copies of these numbers is how the
 * admin page once told curators "up to 24" while the page showed 8.
 *
 * The server's own ceiling (24 per kind, `featured.service` MAX_PER_KIND) is
 * the payload bound; these are the display bounds, always at or under it.
 *  - product: two rows of the five-column "Recently listed" grid.
 *  - category: the "Browse by category" grid's twelve (two rows of six).
 *  - supplier: two rows of four cards.
 */
export const LANDING_FEATURED_LIMITS = {
  banner: 24,
  product: 10,
  category: 12,
  supplier: 8,
};
