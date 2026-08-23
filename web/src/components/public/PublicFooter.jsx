import { Link, useLocation } from 'react-router-dom';

import { Logo } from '../ui/Logo.jsx';

/**
 * The public chrome's footer. Shared by every guest-visible page.
 *
 * 🔴 Company / Resources / Legal render as STATIC TEXT, not links — those pages
 * do not exist yet and `web-ui-notes.md` bans dead anchors. They become links in
 * the same change that ships the pages (ledger rows in docs/UiWebNotes.md).
 * Privacy Policy and Terms of Service are needed before launch.
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
            <h4 className="mb-3 text-sm font-semibold">Company</h4>
            <ul className="space-y-2 text-sm text-white/40">
              <li>About Us</li>
              <li>Careers</li>
              <li>Contact</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Resources</h4>
            <ul className="space-y-2 text-sm text-white/40">
              <li>Blog</li>
              <li>Help Center</li>
              <li>Trade Guides</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">Legal</h4>
            <ul className="space-y-2 text-sm text-white/40">
              <li>Privacy Policy</li>
              <li>Terms of Service</li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
