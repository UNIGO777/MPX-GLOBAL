import { useEffect } from 'react';

/**
 * Puts the unread count in the browser TAB — `(2) MPX Global`.
 *
 * This is the whole "you have a new message" signal on web, and it is chosen
 * deliberately: web push is NOT in the approved notification slice (that is FCM
 * on mobile, D5), and a fake bell would imply a delivery guarantee we do not
 * have. A tab title is honest — it says something changed, only while you are
 * looking, and costs nothing when you are not.
 *
 * ⚠️ Pages set their own `document.title` on navigation, which wipes any prefix
 * written once. Hence the observer: whenever the title changes underneath us,
 * the count is re-applied rather than silently lost.
 */
export function useUnreadTitle(count) {
  useEffect(() => {
    const strip = (title) => title.replace(/^\(\d+\)\s*/, '');

    if (!count) {
      document.title = strip(document.title);
      return undefined;
    }

    const apply = () => {
      const next = `(${count}) ${strip(document.title)}`;
      if (document.title !== next) document.title = next;
    };

    apply();

    const titleEl = document.querySelector('title');
    if (!titleEl) return undefined;

    const observer = new MutationObserver(apply);
    observer.observe(titleEl, { childList: true });

    return () => {
      observer.disconnect();
      document.title = strip(document.title);
    };
  }, [count]);
}
