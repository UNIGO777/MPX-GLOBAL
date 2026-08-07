import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { SearchIcon } from '../../components/ui/icons.jsx';

/**
 * The one not-found page. Every unavailable public entity collapses into it —
 * a draft, hidden, archived or taken-down product, a deactivated category, a
 * dead link — deliberately indistinguishable, so the page never reveals that a
 * listing exists but is unavailable (m2 web brief §4).
 *
 * 🔴 It sets `robots: noindex`. Under the current SPA a crawler still receives
 * HTTP 200 here (SSR/prerender is deferred — `m3-seo.md` §8), so the meta tag is
 * the only thing keeping dead URLs out of the index. Remove it only when the
 * server can answer a real 404/410.
 */
export function NotFound() {
  useEffect(() => {
    const tag = document.createElement('meta');
    tag.name = 'robots';
    tag.content = 'noindex';
    document.head.appendChild(tag);
    return () => tag.remove();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-subtle px-4">
      <div className="w-full max-w-lg rounded-2xl border border-surface-border bg-white p-8 shadow-card">
        <EmptyState icon={SearchIcon} title="We couldn't find that page">
          The link may be out of date, or the listing may no longer be available.
        </EmptyState>
        <div className="mt-2 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-ink-900 px-6 text-sm font-semibold text-white hover:bg-primary-800 sm:w-auto"
          >
            Go to the homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
