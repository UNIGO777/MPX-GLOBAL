import { countryName } from '../../lib/countries.js';

/**
 * One shape for the `/suppliers` cards, whether the supplier is REAL (the
 * public projection from `/public/search?type=supplier`) or a demo sample
 * (`lib/demoSuppliers.js`, only while the demo switch is on).
 *
 * 🔴 A real supplier shows ONLY public-projection fields (`m3-public-projection.md`):
 * name, country, description, logo, cover image, entity type, established year,
 * verified + verifiedAt, member-since year, live-listing count. No website, no
 * turnover, no capacity — those exist in the demo data only (owner, 2026-09-28).
 */
export const initialsOf = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export function fromDemo(d) {
  return {
    key: d.id,
    name: d.name,
    location: `${d.city}, ${d.region}`,
    country: 'IN',
    tagline: d.tagline,
    category: d.category,
    specialities: d.specialities,
    highlight: d.highlight,
    details: [
      { label: 'Product category', value: d.category },
      { label: 'Production capacity', value: d.capacity },
      { label: 'Annual turnover', value: d.turnover },
      { label: 'Languages spoken', value: d.languages.join(', ') },
      { label: 'Website', value: d.website },
    ],
    presence: d.presence,
    verified: true,
    verifiedSince: `${d.verifiedSince}-01`,
    memberSince: d.memberSince,
    established: d.established,
    image: d.image,
    logo: null,
    brand: d.brand,
    person: d.person,
    isDemo: true,
    // A sample has no profile page; the button leads to buyer signup instead.
    sampleTo: '/signup/buyer',
    profileTo: null,
  };
}

export function fromReal(s) {
  const years = s.establishedYear ? new Date().getFullYear() - s.establishedYear : null;
  const details = [
    s.entityType && { label: 'Entity type', value: s.entityType === 'individual' ? 'Individual' : 'Registered business' },
    s.establishedYear && { label: 'Established', value: String(s.establishedYear) },
    s.memberSince && { label: 'Member since', value: String(s.memberSince) },
    { label: 'Live listings', value: String(s.productCount ?? 0) },
  ].filter(Boolean);
  return {
    key: s.id,
    name: s.name,
    location: countryName(s.country) ?? s.country,
    country: s.country,
    tagline: s.description || 'Verified exporter on MPX Global.',
    category: null,
    specialities: [],
    highlight:
      years && years > 0
        ? { value: String(years), label: years === 1 ? 'Year in business' : 'Years in business' }
        : { value: String(s.productCount ?? 0), label: s.productCount === 1 ? 'Live listing' : 'Live listings' },
    details,
    presence: [],
    verified: s.verified,
    verifiedSince: s.verifiedAt,
    memberSince: s.memberSince,
    established: s.establishedYear,
    image: s.coverImage,
    logo: s.logo,
    brand: null,
    person: null,
    isDemo: false,
    // Enquiries are always about a product (M4-4), so a sample request starts
    // on the supplier's profile, where the buyer picks the product.
    sampleTo: `/supplier/${s.slug}`,
    profileTo: `/supplier/${s.slug}`,
  };
}
