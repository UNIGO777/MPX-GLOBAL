import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { MoreVerticalIcon } from './icons.jsx';

const MENU_WIDTH = 224; // w-56

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
 * The popover is `position: fixed` and self-placing (2026-08-11): absolute
 * positioning clipped it inside `overflow-hidden` cards, and it always dropped
 * DOWN — for a bottom row that meant off-screen. It now measures itself after
 * render and flips upward when the viewport space below the trigger is too
 * short. Fixed elements ignore ancestor overflow, so no portal is needed; the
 * DOM stays inside the root, keeping outside-click and focus behaviour.
 *
 * Closes on outside click, Esc, any scroll (a fixed menu would drift from its
 * row), and after any selection.
 */
export function RowMenu({ items, label = 'Row actions' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // { top, left } — null until measured
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    // capture: the scrolling element is the shell's <main>, not the document.
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  // Place after render, when the menu's real height is measurable: below the
  // trigger by default, above it when the space below can't fit the menu.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const btn = btnRef.current?.getBoundingClientRect();
    const menuH = menuRef.current?.offsetHeight ?? 0;
    if (!btn) return;
    const spaceBelow = window.innerHeight - btn.bottom;
    const up = spaceBelow < menuH + 8 && btn.top > menuH + 8;
    setPos({
      top: up ? btn.top - menuH - 4 : btn.bottom + 4,
      left: Math.max(8, btn.right - MENU_WIDTH),
    });
  }, [open]);

  if (!items.length) return null;

  return (
    <div ref={rootRef} className="relative inline-block text-left">
      <button
        ref={btnRef}
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
          ref={menuRef}
          role="menu"
          style={{
            position: 'fixed',
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            // invisible for the measuring frame — no flash at 0,0
            visibility: pos ? 'visible' : 'hidden',
          }}
          className="z-30 w-56 overflow-hidden rounded-xl border border-surface-border bg-white py-2 shadow-lift"
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
