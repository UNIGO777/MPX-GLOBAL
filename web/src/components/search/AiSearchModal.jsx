import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

import { catalogueApi } from '../../api/catalogue.js';
import { SearchIcon, SparkleIcon, XIcon } from '../ui/icons.jsx';
import { Spinner } from '../ui/Spinner.jsx';

/**
 * M3 screen 3 — AI search overlay (design-plans/m3/web-screens-design.md §3,
 * build-plan Phase 3). A query TRANSLATOR, never a second engine: the backend
 * turns one free-text sentence into the same filters `/search` already
 * understands and runs the identical engine (`aiSearch.service.js`) — this
 * modal's only job is collecting the sentence and landing on `/search` with
 * those filters applied. `catalogueApi.aiSearch` is the one call it makes.
 *
 * ⚠️ Deviation from the written design brief: the brief lists a
 * Products|Suppliers toggle inside the modal, but `POST /search/ai` accepts
 * ONLY `{ query }` — the model infers the target from the sentence itself
 * (m3.md's own extraction rules: "supplier" only when the buyer asks for
 * companies rather than goods). A toggle that doesn't influence the call
 * would be a dead control (`.claude/rules/web-ui-notes.md` bans this
 * outright), so it is omitted here rather than shipped non-functional.
 *
 * Reusable by design: the landing hero mounts this exact component too —
 * nothing here is `/search`-specific.
 *
 * 🆕 2026-08-16 — full-screen sheet <lg / centered card lg+, same breakpoint
 * convention `Search.jsx`'s own `FiltersOverlay` already uses (not a new
 * pattern). Labeled "Suggestions" row + per-chip icon, a real spinner during
 * "Thinking…", stacked full-width mobile footer vs. side-by-side desktop —
 * design pass against an owner-supplied mockup. Deliberately NOT adopted from
 * that mockup: a persistent "AI Search" nav tab, a microphone/voice icon (no
 * backend voice capability exists — would be a dead control), and
 * matchmaking-style copy ("secure transaction logistics") — all flagged
 * out-of-scope/unbuilt separately, not part of this component.
 */
const EXAMPLE_PROMPTS = [
  'cheap cotton fabric in bulk',
  'medicines under ₹500',
  'verified suppliers of industrial solvents',
];

const MIN_LEN = 2;
const MAX_LEN = 500;

export function AiSearchModal({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | error | quota
  const cancelledRef = useRef(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setStatus('idle');
    cancelledRef.current = false;
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => textareaRef.current?.focus(), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      clearTimeout(t);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const trimmed = query.trim();
  const valid = trimmed.length >= MIN_LEN && trimmed.length <= MAX_LEN;

  const cancel = () => {
    // Marks any in-flight response as stale (loading is genuinely cancellable
    // — the request may still complete server-side, but its result is
    // dropped rather than navigating the buyer somewhere they didn't ask for).
    cancelledRef.current = true;
    onClose();
  };

  const submit = async () => {
    if (!valid || status === 'loading') return;
    setStatus('loading');
    try {
      const data = await catalogueApi.aiSearch(trimmed);
      if (cancelledRef.current) return;

      // Convert the validated extraction into the exact param shape `/search`
      // already reads (Search.jsx) — AI results are NORMAL results, never a
      // separate view. `fallback: true` means the AI step itself failed
      // server-side; render it as a plain keyword search, no AI framing.
      const p = new URLSearchParams();
      if (data.fallback || !data.extracted) {
        p.set('q', trimmed);
      } else {
        const e = data.extracted;
        if (e.target === 'supplier') p.set('type', 'supplier');
        if (e.keywords?.length) p.set('q', e.keywords.join(' '));
        if (e.category) p.set('category', e.category);
        if (e.country) p.set('country', e.country);
        if (e.verifiedOnly) p.set('verified', '1');
        // §A27.3 mirrored: a supplier search has no price/MOQ/attributes.
        if (e.target !== 'supplier') {
          if (e.priceMax != null) p.set('priceMax', String(e.priceMax));
          if (e.moqMin != null) p.set('moqMin', String(e.moqMin));
          for (const [key, value] of Object.entries(e.attributes ?? {})) {
            p.set(`attr[${key}]`, String(value));
          }
        }
      }

      navigate(`/search?${p.toString()}`, {
        state: { aiAnswer: data.answer, aiFallback: Boolean(data.fallback) },
      });
      onClose();
    } catch (err) {
      if (cancelledRef.current) return;
      // 429 is the per-organisation daily AI quota (aiQuota.service.js), not
      // a network failure — it gets its own honest copy, never a raw error.
      setStatus(err?.response?.status === 429 ? 'quota' : 'error');
    }
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="AI search" className="fixed inset-0 z-50">
      {/* Backdrop only exists lg+ — the sheet fills the screen below that, same
          as FiltersOverlay's own convention. */}
      <button
        type="button"
        aria-label="Close"
        onClick={cancel}
        className="absolute inset-0 hidden bg-ink-900/40 lg:block"
      />
      <div className="relative flex h-full w-full flex-col bg-white lg:mx-auto lg:mt-24 lg:h-auto lg:max-w-lg lg:rounded-2xl lg:shadow-lift">
        <header className="flex shrink-0 items-center justify-between border-b border-surface-border px-5 py-4 lg:border-none lg:px-6 lg:pb-0 lg:pt-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink-900">
            <SparkleIcon className="h-5 w-5 text-primary-600" aria-hidden="true" />
            AI Search
          </h2>
          <button
            type="button"
            onClick={cancel}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 hover:bg-surface-subtle"
          >
            <XIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 lg:flex-none lg:px-6">
          {status === 'quota' ? (
            <div className="rounded-xl border border-warning-200 bg-warning-50 p-4 text-sm text-warning-800">
              You&apos;ve reached today&apos;s AI search limit — regular search still works.
            </div>
          ) : (
            <>
              <label htmlFor="ai-search-query" className="sr-only">
                Describe what you&apos;re looking for
              </label>
              <textarea
                id="ai-search-query"
                ref={textareaRef}
                rows={3}
                maxLength={MAX_LEN}
                placeholder="Try: “sasti cotton fabric bulk order” or “medicines under ₹500”"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={status === 'loading'}
                className="w-full resize-none rounded-xl border border-surface-border p-3 text-[15px] outline-none placeholder:text-ink-400 focus:border-primary-600 focus:ring-2 focus:ring-primary-600/20 disabled:bg-surface-subtle"
              />
              {trimmed.length > MAX_LEN - 60 && (
                <div className="mt-1 text-right text-xs text-muted">{trimmed.length}/{MAX_LEN}</div>
              )}

              <div className="mt-4 text-xs font-bold uppercase tracking-wide text-ink-400">Suggestions</div>
              <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:flex-wrap">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setQuery(prompt)}
                    disabled={status === 'loading'}
                    className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-white px-3 py-1.5 text-left text-xs text-ink-600 transition-colors hover:border-primary-600 hover:text-primary-700 disabled:opacity-50 lg:text-left"
                  >
                    <SearchIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                    {prompt}
                  </button>
                ))}
              </div>

              {status === 'error' && (
                <p className="mt-3 text-sm text-danger-DEFAULT">
                  Something went wrong. You can still search normally with the box on the page.
                </p>
              )}
            </>
          )}
        </div>

        {status !== 'quota' && (
          <footer className="shrink-0 border-t border-surface-border p-5 lg:px-6 lg:py-5">
            {/* Stacked, full-width primary on mobile; side-by-side on desktop. */}
            <div className="flex flex-col-reverse gap-3 lg:flex-row lg:justify-end lg:gap-2">
              <button
                type="button"
                onClick={cancel}
                className="flex min-h-[44px] items-center justify-center rounded-full px-5 text-sm font-semibold text-ink-700 hover:bg-surface-subtle"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!valid || status === 'loading'}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-ink-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === 'loading' ? (
                  <>
                    <Spinner light className="h-4 w-4" />
                    Thinking…
                  </>
                ) : (
                  <>
                    <SparkleIcon className="h-4 w-4" aria-hidden="true" />
                    Search with AI
                  </>
                )}
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
