import { useState } from 'react';

import { PlusIcon } from '../ui/icons.jsx';

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
 *
 * 2026-09-28 restyle (owner: premium): hairline divider rows instead of boxed
 * cards, a larger question, a small two-digit index, a round plus that turns
 * into a close mark, and the FIRST answer open on load so the section shows
 * what it is at a glance.
 */
export function FaqAccordion({ items }) {
  const [open, setOpen] = useState(() => new Set([0]));

  const toggle = (i) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <ul className="min-w-0 border-t border-ink-200/80">
      {items.map(({ q, a }, i) => {
        const isOpen = open.has(i);
        const panelId = `faq-panel-${i}`;
        const buttonId = `faq-button-${i}`;
        return (
          <li key={q} className="border-b border-ink-200/80">
            {/* The heading is real, so the questions show up in a screen
                reader's heading list. The button is the control. */}
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(i)}
                className="group flex w-full items-center gap-4 py-5 text-left focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 sm:gap-5 sm:py-6"
              >
                <span
                  className={`w-6 shrink-0 text-[12px] font-semibold tabular-nums transition-colors ${
                    isOpen ? 'text-primary-700' : 'text-ink-400'
                  }`}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1 text-[15px] font-semibold tracking-tight text-ink-900 transition-colors group-hover:text-primary-700 sm:text-[17px]">
                  {q}
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
                    isOpen ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700 group-hover:bg-ink-200'
                  }`}
                >
                  <PlusIcon
                    className={`h-4 w-4 transition-transform duration-300 motion-reduce:transition-none ${
                      isOpen ? 'rotate-45' : ''
                    }`}
                  />
                </span>
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
                {/* Indented past the index so the answer lines up under the question. */}
                <p className="max-w-2xl pb-6 pl-10 pr-12 text-sm leading-relaxed text-ink-600 sm:pl-11 sm:text-[15px]">
                  {a}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
