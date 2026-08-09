import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { MoreVerticalIcon } from './icons.jsx';

/**
 * The design's per-row "⋮" actions menu. `items` is
 * [{ label, Icon, danger, onSelect | to }] — build it per row so an action the
 * caller can't perform is simply absent rather than rendered dead.
 *
 * An item with `to` renders a real <Link> rather than a button that calls
 * navigate(): it is a navigation, so it should middle-click, open in a new tab
 * and announce as a link. `onSelect` stays for genuine actions (publish, hide,
 * delete).
 *
 * Closes on outside click, Esc, and after any selection.
 */
export function RowMenu({ items, label = 'Row actions' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!items.length) return null;

  return (
    <div ref={rootRef} className="relative inline-block text-left">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
      >
        <MoreVerticalIcon className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-surface-border bg-white py-2 shadow-card"
        >
          {items.map(({ label: text, Icon, onSelect, to, danger }) => {
            const cls = `flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] transition-colors ${
              danger ? 'text-danger hover:bg-danger-50' : 'text-ink-900 hover:bg-ink-50'
            }`;
            const body = (
              <>
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                {text}
              </>
            );
            return to ? (
              <Link key={text} to={to} role="menuitem" className={cls} onClick={() => setOpen(false)}>
                {body}
              </Link>
            ) : (
              <button
                key={text}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onSelect();
                }}
                className={cls}
              >
                {body}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
