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
 *
 * 🆕 2026-09-27 — restructured to the multi-column layout with a legal bar along
 * the bottom that the owner sent (an Alibaba footer).
 *
 * 🔴 **The STRUCTURE was copied, not the contents.** That reference carries
 * Careers, Blog, a Help Center, "Report a violation", payment-network badges and
 * two app-store badges. We have pages for none of them:
 *   · the missing pages are the ones deleted here on 2026-08-23, and are still
 *     an open question with the client (`docs/Client-Requests.md` §4.1);
 *   · store badges wait on the apps being published (§4.4) — there are no links
 *     to point them at yet;
 *   · payment-network logos would be an outright lie. MPX Global holds no money
 *     and moves none; the buyer pays the seller's own account.
 * Every link below goes somewhere that exists today. Columns grow when pages do,
 * not before.
 *
 * 🔴 **"Stay connected" is LinkedIn only, and only when a superadmin has set
 * it.** There are no other accounts to link to, and a row of social icons
 * pointing at nothing is the same defect in a smaller shape.
 *
 * 🔴 **LIGHT, on the owner's instruction (2026-09-27: "in white color").** It
 * was dark, and the reason given at the time — the page above ends on a white
 * FAQ, so a light footer leaves it with no terminus — was real, so the terminus
 * is now drawn instead of implied: a `border-t` hairline above, and the legal
 * bar on `surface-subtle` as in the reference.
 *
 * ⚠️ **The logo variant HAD to change with the ground.** `variant="white"` is
 * the all-white mark for dark surfaces; on white it would have been invisible.
 * `variant="blue"` is the navy-and-red mark drawn for light surfaces.
 *
 * ⚠️ Text colours are not a straight inversion — they were measured. On white:
 * ink-900 20.31:1, ink-600 5.42:1, ink-500 4.97:1. `ink-400` is **2.58:1** and
 * is NOT used for text anywhere here, however muted a link is meant to look.
 */
export function PublicFooter() {
  const { pathname } = useLocation();
  // An in-page anchor only works as a bare hash ON the landing page.
  const hash = (id) => (pathname === '/' ? `#${id}` : `/#${id}`);
  // Step 1a: the published support contact — only what a superadmin has set.
  const { email, phone, hours, company } = useSupportContact();

  const columns = [
    {
      title: 'Marketplace',
      links: [
        { label: 'Categories', to: hash('categories') },
        { label: 'Search', to: '/search' },
        { label: 'AI search', to: '/ai-search' },
        { label: 'Verified suppliers', to: '/search?type=supplier' },
      ],
    },
    {
      title: 'For buyers',
      links: [
        { label: 'Create a buyer account', to: '/signup/buyer' },
        { label: 'How it works', to: hash('how-it-works') },
        { label: 'Common questions', to: hash('faq') },
      ],
    },
    {
      title: 'For sellers',
      links: [
        { label: 'Start selling', to: '/signup/exporter' },
        { label: 'Account login', to: '/signin' },
        { label: 'Why MPX Global', to: hash('platform') },
      ],
    },
    {
      title: 'Support',
      links: [
        { label: 'Help & support', to: '/help' },
        ...(email ? [{ label: email, to: `mailto:${email}`, external: true, breakAll: true }] : []),
        ...(phone ? [{ label: phone, to: `tel:${phone.replace(/\s+/g, '')}`, external: true }] : []),
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', to: '/privacy' },
        { label: 'Terms of Service', to: '/terms' },
      ],
    },
  ];

  return (
    <footer className="border-t border-surface-border bg-white text-ink-900">
      <div className="w-full px-4 py-12 sm:px-6 sm:py-14 lg:px-10 xl:px-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-14">
          <div className="min-w-0">
            <Logo size="md" variant="blue" />
            <p className="mt-3 text-sm leading-relaxed text-ink-600">
              The B2B marketplace connecting verified Indian exporters with international buyers.
            </p>
            {/* Company footer details — only what a superadmin published in Settings (2026-09-25). */}
            {(company.name || company.address) && (
              <address className="mt-5 text-xs not-italic leading-relaxed text-ink-500">
                {company.name && <span className="block font-semibold text-ink-700">{company.name}</span>}
                {company.address && <span className="block whitespace-pre-line">{company.address}</span>}
              </address>
            )}
            {company.linkedinUrl && (
              <div className="mt-5">
                <h4 className="text-sm font-semibold">Stay connected</h4>
                <a
                  href={company.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-ink-700 ring-1 ring-surface-border transition hover:bg-surface-subtle hover:text-primary-700"
                >
                  LinkedIn
                  <span aria-hidden="true">↗</span>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {columns.map((col) => (
              <div key={col.title} className="min-w-0">
                <h4 className="mb-2 text-sm font-semibold">{col.title}</h4>
                <ul className="space-y-0.5 text-sm text-ink-600">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      {l.external || l.to.startsWith('#') || l.to.startsWith('/#') ? (
                        <a
                          href={l.to}
                          className={`inline-block py-1.5 hover:text-primary-700 ${l.breakAll ? 'break-all' : ''}`}
                        >
                          {l.label}
                        </a>
                      ) : (
                        <Link to={l.to} className="inline-block py-1.5 hover:text-primary-700">
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                  {col.title === 'Support' && hours && (email || phone) && (
                    <li className="py-1.5 text-ink-500">{hours}</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* The legal bar, on its own tint as in the reference. */}
      <div className="border-t border-surface-border bg-surface-subtle">
        <div className="flex w-full flex-col items-center gap-3 px-4 py-5 text-xs text-ink-500 sm:px-6 md:flex-row md:justify-between lg:px-10 xl:px-16">
          <p>
            © {new Date().getFullYear()} {company.name || 'MPX Global'}. All rights reserved.
          </p>
          <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link to="/privacy" className="hover:text-primary-700">Privacy Policy</Link>
            <span aria-hidden="true" className="text-ink-300">·</span>
            <Link to="/terms" className="hover:text-primary-700">Terms of Service</Link>
            <span aria-hidden="true" className="text-ink-300">·</span>
            <Link to="/help" className="hover:text-primary-700">Help &amp; support</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
