import { useState } from 'react';

import { ChevronDownIcon } from '../ui/icons.jsx';

/**
 * The landing FAQ — numbered rows that expand (owner, 2026-09-27, to the layout
 * they sent, then "make it smooth").
 *
 * 🔴 **Why this is NOT a native `<details>` any more.** It was one, for the
 * keyboard and screen-reader behaviour that comes free with it. But `<details>`
 * cannot animate its height: the content simply appears. `::details-content`
 * with `interpolate-size` can animate it, and only in very recent Chromium —
 * Safari and Firefox would still snap, which is half a feature.
 *
 * ⚠️ The note that replaced it also claimed `<details>` "works with JavaScript
 * off". That was wrong for THIS app: `index.html` is `<div id="root">` with no
 * prerendering, so without JavaScript nothing on the page renders at all. The
 * argument did not apply, and nothing real is lost by controlling it in React.
 *
 * 🔴 **The height animates with `grid-template-rows: 0fr → 1fr`**, not with a
 * measured pixel height. A JS-measured height breaks the moment the copy
 * reflows — a longer answer, a narrower column, a different font — and it is the
 * usual reason these snap shut at the wrong size. The grid unit resolves to
 * whatever the content actually is, at any width.
 *
 * 🔴 **A closed panel is `invisible`, not merely zero-height.** Zero height with
 * `overflow: hidden` still leaves the text in the accessibility tree, so a
 * screen reader would read out every answer whether or not it was open.
 * `visibility` also transitions as a discrete step — it flips to visible
 * immediately on opening and only after the collapse finishes on closing, which
 * is exactly the behaviour wanted, so it costs nothing to animate around.
 *
 * 🔴 Content stays in the DOM either way, so a crawler that runs JavaScript sees
 * every answer (`m3-seo.md` treats the public pages as SEO surface).
 *
 * More than one row may be open at once. An FAQ where opening the fourth answer
 * closes the one you were half-way through reading is a worse thing to use.
 */
export function FaqAccordion({ items }) {
  const [open, setOpen] = useState(() => new Set());

  const toggle = (i) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <ul className="min-w-0 space-y-3">
      {items.map(({ q, a }, i) => {
        const isOpen = open.has(i);
        const panelId = `faq-panel-${i}`;
        const buttonId = `faq-button-${i}`;
        return (
          <li key={q}>
            <div
              className={`overflow-hidden rounded-2xl bg-white shadow-card ring-1 transition-colors duration-200 ${
                isOpen ? 'ring-primary-600/30' : 'ring-surface-border/70'
              }`}
            >
              {/* The heading is real, so the questions show up in a screen
                  reader's heading list. The button is the control. */}
              <h3>
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => toggle(i)}
                  className="flex w-full items-center gap-3.5 px-4 py-4 text-left focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-600 sm:gap-4 sm:px-5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-primary-600 ring-1 ring-primary-600/40">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold text-ink-900 sm:text-[15px]">
                    {q}
                  </span>
                  <ChevronDownIcon
                    className={`h-4 w-4 shrink-0 text-ink-500 transition-transform duration-300 motion-reduce:transition-none ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </h3>

              <div
                id={panelId}
                aria-labelledby={buttonId}
                className={`grid transition-all duration-300 ease-out motion-reduce:transition-none ${
                  isOpen ? 'visible grid-rows-[1fr]' : 'invisible grid-rows-[0fr]'
                }`}
              >
                {/* The clipper. The grid row is what animates; this is what stops
                    the copy spilling out while the row is still collapsing. */}
                <div className="overflow-hidden">
                  {/* Indented past the number so the answer lines up under the
                      question rather than under its badge. */}
                  <p className="pb-4 pl-[58px] pr-4 text-sm leading-relaxed text-ink-600 sm:pl-[64px] sm:pr-5">
                    {a}
                  </p>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
