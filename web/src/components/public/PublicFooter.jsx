import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useSupportContact } from '../../hooks/useSupportContact.js';
import { PlusIcon } from '../ui/icons.jsx';

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
/**
 * 2026-09-28 — expanded to the owner's second Alibaba reference ("put all this
 * in footer, all the names; if no page, just placeholder").
 *
 * A PLACEHOLDER (`soon: true`) renders as the same text but NOT a link — the
 * owner asked for no "coming soon" labels, just unclickable (2026-09-28); only
 * Trade Finance is tagged. Store badges and social icons likewise look normal
 * and are not links. Every one is logged in `docs/UiWebNotes.md`; when its page
 * ships, give it a `to` and drop `soon`.
 *
 * 🔴 DELIBERATELY LEFT OUT from the reference, even as placeholders — each would
 * be a promise about money or orders that MPX Global does not make (Phase 1 moves
 * no money; escrow/orders are Phase 2, and the owner already agreed not to claim
 * payment protection — see PlatformCards' Payments note):
 *   Secure payments · Money-back guarantee · Guaranteed delivery · After-sales
 *   protections · Refunds · File a trade dispute · Check order status ·
 *   payment-network badges (Visa, Mastercard, T/T…).
 * Also not applicable: Alibaba Lens, their sister-site row, Chinese licence
 * numbers, "Co-Create Pitch" (an Alibaba event).
 */
const FOOTER_COLUMNS = (hash) => [
  {
    title: 'About MPX Global',
    links: [
      { label: 'Why choose MPX Global', to: hash('platform') },
      { label: 'Corporate responsibility', soon: true },
      { label: 'Careers', soon: true },
    ],
  },
  {
    title: 'Trade services',
    links: [
      { label: 'Production monitoring & inspection services', soon: true },
      { label: 'Policies and rules', soon: true },
      // Client request 2026-09-28. 🔴 Bucket B / Phase 2 — announcement only.
      { label: 'Trade Finance', soon: true, comingSoon: true },
    ],
  },
  {
    title: 'Source on MPX Global',
    links: [
      { label: 'Verified manufacturers', to: '/suppliers' },
      { label: 'Categories', to: '/categories' },
      { label: 'AI search', to: '/ai-search' },
      { label: 'Request for Quotation', soon: true },
    ],
  },
  {
    title: 'Help Center',
    links: [
      { label: 'Buyer Help Center', to: '/help' },
      { label: 'Common questions', to: hash('faq') },
      { label: 'Live chat', soon: true },
      { label: 'Report IP infringement', soon: true },
      { label: 'Report a violation', soon: true },
    ],
  },
  {
    title: 'Sell on MPX Global',
    links: [
      { label: 'Start selling', to: '/signup/exporter' },
      { label: 'Become a Verified Supplier', to: '/signup/exporter' },
      { label: 'Account login', to: '/signin' },
      { label: 'Partnerships', soon: true },
    ],
  },
];

const LEGAL_LINKS = [
  { label: 'Legal Notice', soon: true },
  { label: 'Product Listing Policy', soon: true },
  { label: 'Intellectual Property Protection', soon: true },
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms of Use', to: '/terms' },
  { label: 'Integrity Compliance', soon: true },
];

/* Social glyphs — simple outline marks (no icon library for five glyphs). */
const SOCIAL_ICONS = {
  Facebook: <path d="M14 8h2V4.5h-2.5C10.9 4.5 10 6.3 10 8.4V10H8v3.5h2V20h3.5v-6.5h2.3L16 10h-2.5V8.7c0-.5.2-.7.5-.7z" />,
  LinkedIn: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M8 10.5V16M8 8v.01M11.5 16v-3.2c0-1.4.9-2.3 2-2.3s2 .9 2 2.3V16M11.5 10.5V16" />
    </>
  ),
  X: <path d="M5 5l14 14M19 5L5 19" />,
  Instagram: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="12" cy="12" r="3.6" />
      <path d="M16.8 7.2v.01" />
    </>
  ),
  YouTube: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="3.5" />
      <path d="M10.5 9.5v5l4-2.5z" />
    </>
  ),
};
const SOCIAL_ORDER = ['Facebook', 'LinkedIn', 'X', 'Instagram', 'YouTube'];

function SocialGlyph({ name }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {SOCIAL_ICONS[name]}
    </svg>
  );
}

/**
 * A footer link, or — when there is no page yet — plain text that is not a link
 * (owner, 2026-09-28: "no coming soon, just unclickable"). Only Trade Finance
 * carries a "Coming soon" tag. Placeholders are logged in `docs/UiWebNotes.md`.
 */
function FooterLink({ link, small = false }) {
  if (link.soon) {
    return (
      <span aria-disabled="true" className={`inline-block cursor-default ${small ? '' : 'py-1.5'}`}>
        {link.label}
        {link.comingSoon && (
          <span className="ml-1.5 inline-block rounded-full bg-ink-900 px-1.5 py-px align-[1px] text-[9px] font-semibold uppercase leading-normal tracking-wider text-white">
            Coming soon
          </span>
        )}
      </span>
    );
  }
  const cls = `inline-block ${small ? '' : 'py-1.5'} hover:text-primary-700 ${link.breakAll ? 'break-all' : ''}`;
  return link.external || link.to.startsWith('#') || link.to.startsWith('/#') ? (
    <a href={link.to} className={cls}>{link.label}</a>
  ) : (
    <Link to={link.to} className={cls}>{link.label}</Link>
  );
}

/** App-store badge in the stores' own style. Not a link until the apps are published (owner: unclickable). */
function StoreBadge({ store }) {
  return (
    <span
      aria-disabled="true"
      className="inline-flex h-10 cursor-default items-center gap-2 rounded-lg bg-black px-3 text-white"
    >
      {store === 'App Store' ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.5-1-2.5-3.7zM14.1 5.8c.6-.8 1.1-1.8 1-2.8-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.7-1 2.7 1 .1 2-.5 2.7-1.3z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M4 3.5l10 8.5-10 8.5z" fill="#34A853" />
          <path d="M4 3.5l13.5 7.7-3.5 .8z" fill="#FBBC04" />
          <path d="M4 20.5l13.5-7.7-3.5-.8z" fill="#EA4335" />
          <path d="M17.5 11.2l2.8 1.6-2.8 1.6-3.5-2.4z" fill="#4285F4" />
        </svg>
      )}
      <span className="text-left leading-none">
        <span className="block text-[8.5px] uppercase tracking-wider text-white/80">
          {store === 'App Store' ? 'Download on the' : 'Get it on'}
        </span>
        <span className="mt-0.5 block text-[15px] font-semibold tracking-tight">{store}</span>
      </span>
    </span>
  );
}

export function PublicFooter() {
  const { pathname } = useLocation();
  // An in-page anchor only works as a bare hash ON the landing page.
  const hash = (id) => (pathname === '/' ? `#${id}` : `/#${id}`);
  // Step 1a: the published support contact — only what a superadmin has set.
  const { email, phone, company } = useSupportContact();
  const columns = FOOTER_COLUMNS(hash);
  // Phones only: which columns are expanded (sm+ always shows every list).
  const [openCols, setOpenCols] = useState(() => new Set());
  const toggleCol = (t) =>
    setOpenCols((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const social = (
    <div className="flex items-center gap-4 sm:gap-3.5">
      {SOCIAL_ORDER.map((n) =>
        n === 'LinkedIn' && company.linkedinUrl ? (
          <a
            key={n}
            href={company.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="MPX Global on LinkedIn (opens in a new tab)"
            className="text-ink-800 transition-colors hover:text-primary-700"
          >
            <SocialGlyph name={n} />
          </a>
        ) : (
          // No account yet: shown the same, but not a link.
          <span key={n} aria-disabled="true" className="cursor-default text-ink-800">
            <SocialGlyph name={n} />
            <span className="sr-only">{n}</span>
          </span>
        ),
      )}
    </div>
  );

  return (
    <footer className="border-t border-surface-border bg-white text-ink-900">
      {/* Laid out as the owner's Alibaba reference (2026-09-28, "make exact"):
          five centred columns, "Stay connected" under the last one, an app row,
          then the grey legal bar. */}
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-14 lg:px-8">
        {/* Phones (owner, 2026-09-28: "fix footer for phone"): each column is
            a collapsible row — tap the heading to open its links. sm+: the
            reference's columns, always open. */}
        <div className="border-t border-ink-100 sm:grid sm:grid-cols-3 sm:gap-x-6 sm:gap-y-9 sm:border-t-0 lg:grid-cols-5 lg:gap-x-8">
          {columns.map((col, ci) => {
            const isOpen = openCols.has(col.title);
            const listId = `footer-col-${ci}`;
            return (
              <div key={col.title} className="min-w-0 border-b border-ink-100 sm:border-b-0">
                <h4 className="text-[15px] font-bold tracking-tight">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={listId}
                    onClick={() => toggleCol(col.title)}
                    className="flex w-full items-center justify-between py-4 text-left sm:hidden"
                  >
                    {col.title}
                    <PlusIcon
                      className={`h-4 w-4 text-ink-500 transition-transform duration-300 motion-reduce:transition-none ${isOpen ? 'rotate-45' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  <span className="mb-3 hidden sm:block">{col.title}</span>
                </h4>
                <ul
                  id={listId}
                  className={`space-y-1 pb-4 text-[14px] text-ink-600 sm:block sm:pb-0 sm:text-[13.5px] ${isOpen ? 'block' : 'hidden'}`}
                >
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <FooterLink link={l} />
                    </li>
                  ))}
                  {/* Real contact details, when a superadmin published them. */}
                  {col.title === 'Help Center' && email && (
                    <li>
                      <FooterLink link={{ label: email, to: `mailto:${email}`, external: true, breakAll: true }} />
                    </li>
                  )}
                  {col.title === 'Help Center' && phone && (
                    <li>
                      <FooterLink link={{ label: phone, to: `tel:${phone.replace(/\s+/g, '')}`, external: true }} />
                    </li>
                  )}
                </ul>
                {ci === columns.length - 1 && (
                  <div className="mt-5 hidden sm:block">
                    <h4 className="mb-2.5 text-[15px] font-bold tracking-tight">Stay connected</h4>
                    {social}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Phones: "Stay connected" on its own row, always visible. */}
        <div className="mt-6 flex items-center justify-between sm:hidden">
          <span className="text-[15px] font-bold tracking-tight">Stay connected</span>
          {social}
        </div>

        {/* App band (owner, 2026-09-28: drop the "Supplier app" line and
            improve this row). One app for buyers and sellers, so one message. */}
        <div className="mt-6 flex flex-col gap-5 rounded-3xl bg-surface-subtle p-5 sm:mt-10 ring-1 ring-surface-border sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink-900 text-white shadow-sm">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
                <path d="M10.5 18.5h3" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-bold tracking-tight text-ink-900">Trade on the go</p>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-600">
                Search, enquire, chat and agree quotations from your phone — one app for buyers and suppliers.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2.5">
            <StoreBadge store="App Store" />
            <StoreBadge store="Google Play" />
          </div>
        </div>
      </div>

      {/* The legal bar: policy links, then the company line. */}
      <div className="bg-surface-subtle">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 py-5 text-center text-[12.5px] text-ink-500 sm:px-6 lg:px-8">
          <p className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-0.5">
            {LEGAL_LINKS.map((l, i) => (
              <span key={l.label} className="inline-flex items-center gap-2.5">
                {i > 0 && <span aria-hidden="true" className="hidden text-ink-300 sm:inline">·</span>}
                <FooterLink link={l} small />
              </span>
            ))}
          </p>
          <p>
            © {new Date().getFullYear()} {company.name || 'MPX Global'}. All rights reserved.
            {company.address && <span className="hidden sm:inline"> · {company.address.replace(/\n+/g, ', ')}</span>}
          </p>
        </div>
      </div>
    </footer>
  );
}
