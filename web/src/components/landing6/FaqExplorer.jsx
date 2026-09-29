import { useRef, useState } from 'react';

import { ArrowRightIcon } from '../ui/icons.jsx';

/**
 * FAQ, desktop (lg+): QUESTIONS AND ANSWER SIDE BY SIDE (owner, 2026-09-28:
 * "left side too much empty space" → no support card → a full-width stacked
 * list was "bad design, rethink a good design"). The seven questions sit as a
 * list on the left; the chosen one's answer fills a quiet panel on the right,
 * large and readable, with "Next question" to move on. Both columns share one
 * height, so nothing is left empty. Phones and tablets keep the accordion.
 *
 * A vertical ARIA tablist: ↑/↓ move between questions, Home/End jump, only the
 * selected question is in the tab order.
 */
export function FaqExplorer({ items }) {
  const [active, setActive] = useState(0);
  const tabs = useRef([]);
  const n = items.length;

  const go = (i) => {
    const next = (i + n) % n;
    setActive(next);
    tabs.current[next]?.focus();
  };
  const onKeyDown = (e) => {
    const keys = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: n - 1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    go(keys[e.key]);
  };

  const item = items[active];
  const num = (i) => String(i + 1).padStart(2, '0');

  return (
    <div className="grid grid-cols-[0.95fr_1.05fr] items-stretch gap-8 xl:gap-12">
      <div role="tablist" aria-orientation="vertical" aria-label="Common questions" onKeyDown={onKeyDown} className="flex flex-col">
        {items.map((it, i) => {
          const on = i === active;
          return (
            <button
              key={it.q}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`faq-tab-${i}`}
              aria-selected={on}
              aria-controls="faq-answer"
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              className={`group relative flex items-center gap-4 rounded-2xl px-5 py-4 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/20 ${
                on ? 'bg-white shadow-card ring-1 ring-ink-200/60' : 'hover:bg-ink-50'
              }`}
            >
              <span aria-hidden="true" className={`absolute inset-y-3 left-0 w-[3px] rounded-full transition-colors ${on ? 'bg-primary-600' : 'bg-transparent'}`} />
              <span className={`text-[12px] font-semibold tabular-nums ${on ? 'text-primary-700' : 'text-ink-400'}`}>{num(i)}</span>
              <span className={`min-w-0 flex-1 text-[15.5px] tracking-tight ${on ? 'font-semibold text-ink-900' : 'font-medium text-ink-700 group-hover:text-ink-900'}`}>
                {it.q}
              </span>
              <ArrowRightIcon
                className={`h-4 w-4 shrink-0 transition-all duration-200 motion-reduce:transition-none ${on ? 'translate-x-0 text-primary-600 opacity-100' : '-translate-x-1 text-ink-400 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}`}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="faq-answer"
        aria-labelledby={`faq-tab-${active}`}
        className="relative isolate flex flex-col overflow-hidden rounded-3xl bg-surface-subtle p-8 ring-1 ring-ink-200/50 xl:p-10"
      >
        {/* A large, faint number — which question this is. Decoration. */}
        <span aria-hidden="true" className="absolute -right-2 -top-6 -z-10 select-none text-[160px] font-extrabold leading-none tracking-tighter text-ink-900/[0.04]">
          {num(active)}
        </span>
        <div key={active} className="animate-fade-in motion-reduce:animate-none">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">
            Question {num(active)} of {num(n - 1)}
          </p>
          <h3 className="mt-3 text-balance text-[26px] font-bold leading-tight tracking-tight text-ink-900 xl:text-[30px]">{item.q}</h3>
          <p className="mt-4 max-w-xl text-pretty text-[16px] leading-relaxed text-ink-600">{item.a}</p>
        </div>
        <button
          type="button"
          onClick={() => go(active + 1)}
          className="group mt-auto inline-flex items-center gap-2 self-start pt-8 text-[14px] font-semibold text-ink-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-600/20"
        >
          {active === n - 1 ? 'Back to the first question' : 'Next question'}
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-white transition-colors duration-300 group-hover:bg-primary-600">
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </span>
        </button>
      </div>
    </div>
  );
}
