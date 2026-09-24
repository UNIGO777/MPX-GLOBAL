import { Link, useLocation } from 'react-router-dom';

import { Logo } from '../ui/Logo.jsx';
import { useSupportContact } from '../../hooks/useSupportContact.js';

/**
 * The public chrome's footer. Shared by every guest-visible page.
 *
 * ✅ 2026-08-23 — the dead columns are GONE and Legal is real.
 *
 * Company (About / Careers / Contact) and Resources (Blog / Help Center / Trade
 * Guides) rendered as greyed STATIC TEXT because those pages do not exist. Six
 * pieces of furniture pretending to be navigation is worse than a smaller
 * footer, so they were removed rather than kept as scenery — they come back in
 * the same change that ships the pages. Replaced with "Discover", which points
 * at surfaces that actually exist.
 *
 * Privacy Policy and Terms of Service are now REAL links (`/privacy`, `/terms`
 * → `pages/public/Legal.jsx`), which also gives the signup fine print somewhere
 * to point.
 */
export function PublicFooter() {
  const { pathname } = useLocation();
  const categoriesHref = pathname === '/' ? '#categories' : '/#categories';
  // Step 1a: the published support contact — only what a superadmin has set.
  const { email, phone, hours, company } = useSupportContact();

  return (
    <footer className="bg-ink-900 px-4 py-14 text-white sm:px-6">
      <div className="flex w-full flex-col justify-between gap-12 md:flex-row">
        <div className="max-w-xs">
          <Logo size="md" variant="white" />
          <p className="mt-3 text-sm text-white/60">
            The B2B marketplace connecting verified Indian exporters with international buyers.
          </p>
          {/* Company footer details — only what a superadmin published in Settings (2026-09-25). */}
          {(company.name || company.address) && (
            <address className="mt-5 text-xs not-italic leading-relaxed text-white/55">
              {company.name && <span className="block font-semibold text-white/75">{company.name}</span>}
              {company.address && <span className="block whitespace-pre-line">{company.address}</span>}
            </address>
          )}
          {company.linkedinUrl && (
            <a
              href={company.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white"
            >
              LinkedIn
              <span aria-hidden="true">↗</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
          <p className="mt-6 text-xs text-white/40">© {new Date().getFullYear()} {company.name || 'MPX Global'}. All rights reserved.</p>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <h4 className="mb-3 text-sm font-semibold">Marketplace</h4>
            <ul className="space-y-1 text-sm text-white/60">
              <li><a href={categoriesHref} className="inline-block py-1.5 hover:text-white">Categories</a></li>
              <li><Link to="/signup/buyer" className="inline-block py-1.5 hover:text-white">For Buyers</Link></li>
              <li><Link to="/signup/exporter" className="inline-block py-1.5 hover:text-white">For Sellers</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Discover</h4>
            <ul className="space-y-1 text-sm text-white/60">
              <li><Link to="/search" className="inline-block py-1.5 hover:text-white">Search</Link></li>
              <li><Link to="/ai-search" className="inline-block py-1.5 hover:text-white">AI search</Link></li>
              <li><Link to="/search?type=supplier" className="inline-block py-1.5 hover:text-white">Suppliers</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Support</h4>
            <ul className="space-y-1 text-sm text-white/60">
              <li><Link to="/help" className="inline-block py-1.5 hover:text-white">Help &amp; support</Link></li>
              {email && (
                <li><a href={`mailto:${email}`} className="inline-block break-all py-1.5 hover:text-white">{email}</a></li>
              )}
              {phone && (
                <li><a href={`tel:${phone.replace(/\s+/g, '')}`} className="inline-block py-1.5 hover:text-white">{phone}</a></li>
              )}
              {hours && (email || phone) && <li className="py-1.5 text-white/45">{hours}</li>}
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Legal</h4>
            <ul className="space-y-1 text-sm text-white/60">
              <li><Link to="/privacy" className="inline-block py-1.5 hover:text-white">Privacy Policy</Link></li>
              <li><Link to="/terms" className="inline-block py-1.5 hover:text-white">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
