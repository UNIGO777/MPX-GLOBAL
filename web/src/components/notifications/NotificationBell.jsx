import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificationsApi, notificationKeys } from '../../api/notifications.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useUnreadNotifications } from '../../hooks/useNotifications.js';
import { cp } from '../../lib/consolePath.js';
import { BellIcon } from '../ui/icons.jsx';
import { SkeletonRows } from '../ui/Skeleton.jsx';
import { NotificationItem } from './NotificationItem.jsx';
import { linkFor } from './notificationMeta.js';

/** Where "See all" goes: the company's own page, or the reader's console. */
export function notificationsPagePath(role) {
  if (role === 'buyer' || role === 'exporter') return `/${role}/notifications`;
  return cp('/admin/notifications');
}

/**
 * B8 · the bell in the console/portal top bar (web; owner override 2026-09-25).
 * The count comes from the server; the panel loads the latest ten only when
 * opened. Closes on outside click, Esc and after following a notification.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const unread = useUnreadNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const latest = useQuery({
    queryKey: notificationKeys.list({ panel: true }),
    queryFn: () => notificationsApi.list(),
    enabled: open,
    staleTime: 5_000,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  const markRead = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: refresh });
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: refresh });

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = (item) => {
    setOpen(false);
    if (!item.read) markRead.mutate(item.id);
    const to = linkFor(item.link);
    if (to) navigate(to);
  };

  const items = (latest.data?.items ?? []).slice(0, 10);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Notifications — ${unread} unread` : 'Notifications'}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 min-w-[1.15rem] rounded-full bg-white px-1 text-center text-[10.5px] font-bold leading-[1.15rem] text-primary-700 ring-2 ring-primary-800"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-2 top-[84px] z-50 overflow-hidden rounded-2xl border border-surface-border bg-white text-ink-900 shadow-lift sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
            <p className="text-[14px] font-bold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="text-[12.5px] font-semibold text-primary-700 hover:underline disabled:opacity-60"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-[min(26rem,calc(100dvh-10rem))] overflow-y-auto overscroll-contain">
            {latest.isLoading ? (
              <SkeletonRows rows={4} />
            ) : latest.error ? (
              <p className="px-4 py-6 text-center text-[13px] text-muted">
                Couldn&apos;t load notifications.{' '}
                <button type="button" onClick={() => latest.refetch()} className="font-semibold text-primary-700 hover:underline">
                  Try again
                </button>
              </p>
            ) : items.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <BellIcon className="mx-auto h-7 w-7 text-ink-300" aria-hidden="true" />
                <p className="mt-2 text-[13.5px] font-semibold text-ink-800">You&apos;re all caught up</p>
                <p className="mt-1 text-[12.5px] text-muted">New activity on your account shows up here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-surface-border">
                {items.map((item) => (
                  <li key={item.id}>
                    <NotificationItem item={item} onOpen={openItem} compact />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            to={notificationsPagePath(user?.role)}
            onClick={() => setOpen(false)}
            className="block border-t border-surface-border px-4 py-3 text-center text-[13px] font-semibold text-primary-700 hover:bg-primary-50/50"
          >
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
