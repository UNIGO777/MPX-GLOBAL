import { formatListTime } from '../../lib/format.js';
import { metaFor } from './notificationMeta.js';

/**
 * One notification row — shared by the bell's panel and the full page, so the
 * two can't drift. A button, not a link: opening one also marks it read.
 */
export function NotificationItem({ item, onOpen, compact = false }) {
  const { Icon, tint } = metaFor(item.type);
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`group flex w-full items-start gap-3 text-left transition-colors hover:bg-ink-50 focus-visible:bg-ink-50 focus-visible:outline-none ${
        compact ? 'px-4 py-3' : 'px-4 py-3.5 sm:px-5'
      } ${item.read ? '' : 'bg-primary-50/40'}`}
    >
      <span aria-hidden="true" className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[13.5px] leading-snug ${item.read ? 'font-medium text-ink-700' : 'font-semibold text-ink-900'}`}>
          {item.title}
          {item.count > 1 && <span className="ml-1 font-normal text-muted">({item.count})</span>}
        </span>
        {item.body && <span className="mt-0.5 block truncate text-[12.5px] text-muted">{item.body}</span>}
        <span className="mt-1 block text-[11.5px] text-ink-400">{formatListTime(item.at)}</span>
      </span>
      {!item.read && (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-600">
          <span className="sr-only">Unread</span>
        </span>
      )}
    </button>
  );
}
