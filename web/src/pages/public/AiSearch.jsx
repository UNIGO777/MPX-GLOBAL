import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { catalogueApi } from '../../api/catalogue.js';
import { NoImagePanel } from '../../components/catalogue/NoImagePanel.jsx';
import { ProductCard } from '../../components/catalogue/ProductCard.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { VerifiedTick } from '../../components/ui/VerifiedTick.jsx';
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
  SearchIcon,
  SparkleIcon,
} from '../../components/ui/icons.jsx';
import { countryName } from '../../lib/countries.js';

/**
 * M3 screen 3 — AI search as a FULL-MODE PAGE at `/ai-search`.
 *
 * 🆕 2026-08-16 (owner, after an explicit scope check): the response renders
 * ON THIS PAGE — AI message, product results below it, and a browsable
 * "related categories" sidebar — instead of navigating to `/search`. This is
 * the owner's conscious deviation from the earlier "AI results land on
 * /search" decision. It is NOT the Bucket-B chatbot: still strictly
 * single-turn (one question → one analysis → results; no conversation
 * memory), and every piece runs on EXISTING M3 endpoints:
 *
 *   1. `POST /search/ai` { query }        → answer sentence + extracted filters
 *   2. `GET  /public/search` (extraction) → the products/suppliers shown here
 *   3. `GET  /public/facets` (extraction) → the related-category sidebar
 *      (top categories, or subcategories when the AI picked a category —
 *      the facet service's own "where can I go next" semantics)
 *
 * After the first search the composer docks to the BOTTOM, assistant-style
 * ("Search something else…") — each send REPLACES the results; nothing
 * accumulates, because nothing is remembered server-side.
 *
 * "View all results" hands the same params to `/search`, so the full
 * filter/sort toolkit stays one click away and the engines never fork.
 *
 * 🔴 SEO: noindex,follow — an input surface, never an indexable result.
 */
const EXAMPLE_PROMPTS = [
  'cheap cotton fabric in bulk',
  'medicines under ₹500',
  'verified suppliers of industrial solvents',
];

const MIN_LEN = 2;
const MAX_LEN = 500;
const RESULT_PAGE_SIZE = 8;

/** Extraction → the exact param shapes the M3 APIs already accept: `api` for
 *  search/facets calls, `url` for the "/search?…" hand-off link. */
function paramsFromExtraction(extracted, fallbackQuery) {
  const api = {};
  const url = new URLSearchParams();
  if (!extracted) {
    api.q = fallbackQuery;
    api.type = 'product';
    url.set('q', fallbackQuery);
    return { api, url, target: 'product' };
  }
  const target = extracted.target === 'supplier' ? 'supplier' : 'product';
  api.type = target;
  if (target === 'supplier') url.set('type', 'supplier');
  if (extracted.keywords?.length) {
    api.q = extracted.keywords.join(' ');
    url.set('q', api.q);
  }
  if (extracted.country) {
    api.country = extracted.country;
    url.set('country', extracted.country);
  }
  if (extracted.verifiedOnly) {
    api.verifiedOnly = 'true';
    url.set('verified', '1');
  }
  // §A27.3 mirrored: a supplier search has no category/price/MOQ/attributes.
  if (target !== 'supplier') {
    if (extracted.category) {
      api.category = extracted.category;
      url.set('category', extracted.category);
    }
    if (extracted.priceMax != null) {
      api.priceMax = String(extracted.priceMax);
      url.set('priceMax', String(extracted.priceMax));
    }
    if (extracted.moqMin != null) {
      api.moqMin = String(extracted.moqMin);
      url.set('moqMin', String(extracted.moqMin));
    }
    for (const [key, value] of Object.entries(extracted.attributes ?? {})) {
      api[`attr[${key}]`] = String(value);
      url.set(`attr[${key}]`, String(value));
    }
  }
  return { api, url, target };
}

/** Compact supplier result row — public seller projection fields only. */
function SupplierResult({ supplier }) {
  return (
    <li>
      <Link
        to={`/supplier/${supplier.slug}`}
        className="flex items-center gap-3.5 rounded-xl border border-surface-border bg-white p-4 shadow-card transition-all hover:border-primary-600 hover:shadow-lift"
      >
        {supplier.logo ? (
          <img src={supplier.logo} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-surface-border" />
        ) : (
          <NoImagePanel label={supplier.name} monogram ratio="h-12 w-12" className="shrink-0 rounded-xl" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-bold text-ink-900">{supplier.name}</span>
            {supplier.verified && <VerifiedTick verified compact />}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            {supplier.country && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {countryName(supplier.country) ?? supplier.country}
              </span>
            )}
            <span>
              {supplier.productCount} listing{supplier.productCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-300" aria-hidden="true" />
      </Link>
    </li>
  );
}

export function AiSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error | quota
  // One answered question at a time — the page's whole "session". Replaced on
  // every send; deliberately never accumulated (single-turn, not a chatbot).
  const [session, setSession] = useState(null); // { question, answer, fallback, api, url, target }
  const goneRef = useRef(false);
  const textareaRef = useRef(null);
  const dockRef = useRef(null);

  useEffect(() => {
    goneRef.current = false;
    textareaRef.current?.focus({ preventScroll: true });
    return () => {
      goneRef.current = true;
    };
  }, []);

  useEffect(() => {
    const previous = document.title;
    document.title = 'AI Search — MPX Global';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex,follow';
    document.head.appendChild(robots);
    return () => {
      document.title = previous;
      robots.remove();
    };
  }, []);

  const trimmed = query.trim();
  const valid = trimmed.length >= MIN_LEN && trimmed.length <= MAX_LEN;

  const submit = async () => {
    if (!valid || status === 'loading') return;
    setStatus('loading');
    try {
      const data = await catalogueApi.aiSearch(trimmed);
      if (goneRef.current) return;
      const { api, url, target } = paramsFromExtraction(data.fallback ? null : data.extracted, trimmed);
      setSession({
        question: trimmed,
        answer: data.answer ?? null,
        message: data.message ?? null,
        fallback: Boolean(data.fallback),
        api,
        url: url.toString(),
        target,
      });
      setStatus('idle');
      setQuery('');
      // Composer just docked (first search) — keep the keyboard flow alive.
      setTimeout(() => dockRef.current?.focus({ preventScroll: true }), 0);
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (goneRef.current) return;
      // 429 is the per-organisation daily AI quota (aiQuota.service.js), not
      // a network failure — it gets its own honest copy, never a raw error.
      setStatus(err?.response?.status === 429 ? 'quota' : 'error');
    }
  };

  // Results for the answered question — the SAME engine `/search` uses.
  const results = useQuery({
    queryKey: ['ai-page-results', session?.api],
    queryFn: () => catalogueApi.search({ ...session.api, page: 1, pageSize: RESULT_PAGE_SIZE }),
    enabled: Boolean(session),
  });
  const facets = useQuery({
    queryKey: ['ai-page-facets', session?.api],
    queryFn: () => catalogueApi.facets(session.api),
    enabled: Boolean(session) && session.target === 'product',
  });

  const total = results.data?.total ?? 0;
  const rows = (session?.target === 'supplier' ? results.data?.suppliers : results.data?.products) ?? [];
  // SUB-categories (owner, 2026-08-16) — leaf-level facet, same source the
  // /search rail uses, so both pages share one architecture.
  const relatedCategories = facets.data?.facets?.subCategory ?? [];

  const onComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  /* ---------- shared bits ---------- */

  const modeHeader = (
    <header className="bg-white shadow-sm">
      <div className="flex h-16 w-full items-center gap-3 px-4 sm:px-6 lg:px-10 xl:px-16">
        <button
          type="button"
          onClick={() => navigate('/search')}
          aria-label="Back to search"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-surface-border text-ink-700 transition-colors hover:border-primary-600 hover:text-primary-700"
        >
          <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[15px] font-bold leading-tight text-ink-900">
            AI Search
            <SparkleIcon className="h-4 w-4 text-primary-600" aria-hidden="true" />
          </div>
          <p className="truncate text-xs text-muted">Your smart sourcing assistant</p>
        </div>
      </div>
    </header>
  );

  const quotaPanel = (
    <div className="rounded-3xl border border-warning-200 bg-warning-50 p-6 text-center">
      <p className="text-sm text-warning-800">
        You&apos;ve reached today&apos;s AI search limit — regular search still works.
      </p>
      <button
        type="button"
        onClick={() => navigate('/search')}
        className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-ink-900 px-6 text-sm font-semibold text-white hover:bg-primary-800"
      >
        Back to search
      </button>
    </div>
  );

  /* ---------- FIRST-VISIT STAGE (no question answered yet) ---------- */

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary-50/60 via-white to-surface-subtle/60 text-ink-900">
        {modeHeader}

        <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-1/2 h-72 w-[42rem] max-w-full -translate-x-1/2 rounded-full bg-primary-200/50 blur-3xl" />
            <div className="absolute bottom-0 right-[-10rem] h-64 w-96 rounded-full bg-primary-100/60 blur-3xl" />
            <div className="absolute bottom-[-6rem] left-[-8rem] h-56 w-80 rounded-full bg-primary-200/40 blur-3xl" />
          </div>

          <div className="relative w-full max-w-3xl">
            <div className="flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-800 text-white shadow-lift">
                <SparkleIcon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <h1 className="mt-4 text-center text-[26px] font-bold leading-tight tracking-tight text-ink-900 sm:text-3xl md:text-4xl">
              What can we source for you today?
            </h1>
            <p className="mt-2.5 text-center text-sm text-ink-500 md:text-[15px]">
              Plain words are enough — we&apos;ll analyse them and bring back matching products and categories.
            </p>

            <div className="mt-8">
              {status === 'quota' ? (
                quotaPanel
              ) : (
                <>
                  <div className="rounded-3xl border border-surface-border bg-white p-4 shadow-card transition-shadow focus-within:border-primary-600 focus-within:shadow-lift sm:p-5">
                    <label htmlFor="ai-search-query" className="sr-only">
                      Describe what you&apos;re looking for
                    </label>
                    <div className="flex items-start gap-2.5">
                      <SparkleIcon className="mt-1 h-4 w-4 shrink-0 text-primary-500" aria-hidden="true" />
                      <textarea
                        id="ai-search-query"
                        ref={textareaRef}
                        rows={4}
                        maxLength={MAX_LEN}
                        placeholder="Describe what you want to source — “sasti cotton fabric bulk order”, “medicines under ₹500”…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onComposerKeyDown}
                        disabled={status === 'loading'}
                        className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-ink-400 disabled:opacity-60 sm:text-base"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-xs text-muted">
                        {trimmed.length > MAX_LEN - 60
                          ? `${trimmed.length}/${MAX_LEN}`
                          : 'Enter to search · Shift+Enter for a new line'}
                      </span>
                      <button
                        type="button"
                        onClick={submit}
                        disabled={!valid || status === 'loading'}
                        aria-label="Search with AI"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white shadow-card transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-ink-300"
                      >
                        {status === 'loading' ? (
                          <Spinner light className="h-4 w-4" />
                        ) : (
                          <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  {status === 'loading' && (
                    <p className="mt-3 flex items-center justify-center gap-2 text-sm text-primary-700" aria-live="polite">
                      <Spinner className="h-4 w-4 text-primary-600" />
                      Analysing your request…
                    </p>
                  )}
                  {status === 'error' && (
                    <p className="mt-3 text-center text-sm text-danger">
                      Something went wrong. You can still search normally on the search page.
                    </p>
                  )}

                  <div className="mt-7 text-center text-xs font-bold uppercase tracking-wide text-ink-400">
                    Try asking
                  </div>
                  <div className="mt-2.5 flex flex-wrap justify-center gap-2.5">
                    {EXAMPLE_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          setQuery(prompt);
                          textareaRef.current?.focus({ preventScroll: true });
                        }}
                        disabled={status === 'loading'}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-surface-border bg-white px-4 text-sm text-ink-700 shadow-card transition-colors hover:border-primary-600 hover:text-primary-700 disabled:opacity-50"
                      >
                        {prompt}
                        <ArrowRightIcon className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                      </button>
                    ))}
                  </div>

                  <div className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                      { n: '1', title: 'Describe your need', body: 'Any wording, any language — price and quantity included.' },
                      { n: '2', title: 'AI analyses it', body: 'Your sentence becomes a real search: category, price, country.' },
                      { n: '3', title: 'Results appear here', body: 'Matching products plus related categories to browse.' },
                    ].map((step) => (
                      <div key={step.n} className="flex items-start gap-3 sm:block sm:text-center">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary-200 bg-white text-xs font-bold text-primary-700 sm:mx-auto">
                          {step.n}
                        </span>
                        <div className="sm:mt-2">
                          <div className="text-[13px] font-semibold text-ink-800">{step.title}</div>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted">{step.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </main>

        <footer className="pb-6 text-center text-xs text-muted">
          © 2026 MPX Global. AI search runs on the same engine as regular search.
        </footer>
      </div>
    );
  }

  /* ---------- ANSWERED STAGE — message, sidebar, results, docked composer ---------- */

  return (
    <div className="flex min-h-screen flex-col bg-white text-ink-900">
      {modeHeader}

      {/* pb-28: the docked composer floats over this column — without the
          clearance the last product card sat behind it (owner screenshot). */}
      <main className="w-full flex-1 px-4 pb-36 pt-6 sm:px-6 sm:pb-28 lg:px-10 xl:px-16">
        {/* --- answer header: no chat bubbles (they read clunky at desktop
            width) — the question is an eyebrow line, the AI's message IS the
            page headline, count below. One composed block, one border. --- */}
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex items-start gap-3.5 border-b border-surface-border pb-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-800 text-white shadow-card">
              <SparkleIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-400">
                You asked
                <span className="ml-2 normal-case tracking-normal text-ink-600 font-medium">“{session.question}”</span>
              </p>
              {status === 'loading' ? (
                <h1 className="mt-1.5 flex items-center gap-2.5 text-lg font-bold text-ink-900 sm:text-xl" aria-live="polite">
                  <Spinner className="h-4 w-4 text-primary-600" />
                  Analysing your request…
                </h1>
              ) : (
                <h1 className="mt-1.5 text-lg font-bold leading-snug text-ink-900 sm:text-xl" aria-live="polite">
                  {session.fallback
                    ? 'Here are keyword matches for your request.'
                    : session.message ?? session.answer ?? 'Here is what we found for your request.'}
                </h1>
              )}
              {results.isSuccess && (
                <p className="mt-1 text-sm text-muted">
                  {total} match{total === 1 ? '' : 'es'}
                  {total > RESULT_PAGE_SIZE ? ` — showing the first ${RESULT_PAGE_SIZE}` : ''}
                </p>
              )}
            </div>
          </div>

          {/* --- workspace: sticky category rail + results grid --- */}
          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* Related categories — browsable, straight from the facet engine.
                Hidden in supplier mode (facets are product-scoped). Sticky
                rail on lg+; horizontal chip row on phones (no stranded card). */}
            {session.target === 'product' && (
              <>
                <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden" aria-label="Related categories">
                  {relatedCategories.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/category/${cat.slug}`}
                      className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full border border-surface-border bg-white px-3.5 text-sm font-medium text-ink-700 shadow-card"
                    >
                      {cat.name}
                      <span className="text-xs text-muted">{cat.count}</span>
                    </Link>
                  ))}
                </nav>
                <aside className="hidden shrink-0 lg:sticky lg:top-6 lg:block lg:w-60 xl:w-64" aria-label="Related categories">
                  <div className="rounded-2xl border border-surface-border bg-white shadow-card">
                    <h2 className="border-b border-surface-border px-4 py-3.5 text-[15px] font-bold text-ink-900">
                      Related Categories
                    </h2>
                    <div className="max-h-[380px] overflow-y-auto px-4 py-1.5">
                    {facets.isPending ? (
                      <div className="space-y-2.5 py-2.5">
                        {Array.from({ length: 4 }, (_, i) => (
                          <Skeleton key={i} className="h-5 w-full" />
                        ))}
                      </div>
                    ) : relatedCategories.length === 0 ? (
                      <p className="py-2.5 text-sm text-muted">No matching categories.</p>
                    ) : (
                      <ul>
                        {relatedCategories.map((cat) => (
                          <li key={cat.id}>
                            <Link
                              to={`/category/${cat.slug}`}
                              className="group flex min-h-[44px] items-center justify-between gap-2 border-b border-surface-border/60 py-2.5 text-sm text-ink-700 last:border-0 hover:text-primary-700"
                            >
                              <span className="min-w-0 truncate font-medium">{cat.name}</span>
                              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
                                {cat.count}
                                <ChevronRightIcon className="h-3.5 w-3.5 text-ink-300 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    </div>
                  </div>
                  <Link
                    to="/categories"
                    className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 px-1 text-sm font-semibold text-primary-700 hover:text-primary-800"
                  >
                    Browse all categories
                    <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </aside>
              </>
            )}

            {/* Results */}
            <div className="min-w-0 flex-1">
              <h2 className="mb-3 text-[15px] font-bold text-ink-900">
                {session.target === 'supplier' ? 'Matching suppliers' : 'Matching products'}
              </h2>
              {results.isPending && (
                <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true" aria-label="Loading results">
                  {Array.from({ length: 8 }, (_, i) => (
                    <li key={i} className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-card">
                      <Skeleton className="aspect-[4/3] w-full rounded-none" />
                      <div className="space-y-2 p-3.5">
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-5 w-2/3" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {results.isError && (
                <div className="rounded-2xl border border-surface-border bg-white p-6 text-center shadow-card">
                  <p className="text-sm text-ink-700">We couldn&apos;t load the results.</p>
                  <button
                    type="button"
                    onClick={results.refetch}
                    className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full bg-ink-900 px-6 text-sm font-semibold text-white hover:bg-primary-800"
                  >
                    Try again
                  </button>
                </div>
              )}

              {results.isSuccess && total === 0 && (
                <div className="rounded-2xl border border-surface-border bg-white p-8 text-center shadow-card">
                  <SearchIcon className="mx-auto h-6 w-6 text-ink-300" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-ink-800">Nothing matched that request</p>
                  <p className="mt-1 text-sm text-muted">
                    Try different wording below, or browse a related category.
                  </p>
                </div>
              )}

              {results.isSuccess && total > 0 && (
                <>
                  {session.target === 'supplier' ? (
                    <ul className="flex flex-col gap-3">
                      {rows.map((supplier) => (
                        <SupplierResult key={supplier.id} supplier={supplier} />
                      ))}
                    </ul>
                  ) : (
                    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                      {rows.map((product) => (
                        <ProductCard key={product.id} product={product} to={`/product/${product.slug}`} />
                      ))}
                    </ul>
                  )}
                  <div className="mt-5">
                    <Link
                      to={`/search?${session.url}`}
                      state={{ aiAnswer: session.message ?? session.answer, aiFallback: session.fallback }}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-surface-border bg-white px-5 text-sm font-semibold text-ink-900 shadow-card transition-colors hover:border-primary-600 hover:text-primary-700"
                    >
                      View all {total} result{total === 1 ? '' : 's'} with filters
                      <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* --- docked composer: a floating pill over a soft fade, not a hard
          white strip — the assistant's persistent ask-again affordance. --- */}
      <div className="sticky bottom-0 bg-gradient-to-t from-white via-white/90 to-transparent px-4 pb-5 pt-10 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          {status === 'quota' ? (
            <p className="rounded-full border border-warning-200 bg-warning-50 px-5 py-3 text-center text-sm text-warning-800 shadow-card">
              You&apos;ve reached today&apos;s AI search limit — regular search still works.
            </p>
          ) : (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
                className="flex h-[54px] items-center gap-1 rounded-full border border-surface-border bg-white py-1.5 pl-2 pr-1.5 shadow-lift ring-1 ring-ink-900/5 focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-600/20"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-800 text-white" aria-hidden="true">
                  <SparkleIcon className="h-4 w-4" />
                </span>
                <input
                  ref={dockRef}
                  type="text"
                  maxLength={MAX_LEN}
                  aria-label="Search something else"
                  placeholder="Search something else…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={status === 'loading'}
                  className="h-full min-w-0 flex-1 bg-transparent px-2 text-[15px] outline-none placeholder:text-ink-400 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={!valid || status === 'loading'}
                  aria-label="Search with AI"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-primary-600 to-primary-800 text-white shadow-card transition-all hover:from-primary-500 hover:to-primary-700 hover:shadow-lift disabled:cursor-not-allowed disabled:from-ink-200 disabled:to-ink-300 disabled:shadow-none"
                >
                  {status === 'loading' ? (
                    <Spinner light className="h-4 w-4" />
                  ) : (
                    <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </form>
              {status === 'error' && (
                <p className="mt-2 text-center text-sm text-danger">
                  Something went wrong — try again, or use regular search.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
