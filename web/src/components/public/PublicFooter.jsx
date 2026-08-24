import { Link, useLocation } from 'react-router-dom';

import { Logo } from '../ui/Logo.jsx';

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

  return (
    <footer className="bg-ink-900 px-4 py-14 text-white sm:px-6">
      <div className="flex w-full flex-col justify-between gap-12 md:flex-row">
        <div className="max-w-xs">
          <Logo size="md" variant="white" />
          <p className="mt-3 text-sm text-white/60">
            The B2B marketplace connecting verified Indian exporters with international buyers.
          </p>
          <p className="mt-6 text-xs text-white/40">© 2026 MPX Global. All rights reserved.</p>
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
